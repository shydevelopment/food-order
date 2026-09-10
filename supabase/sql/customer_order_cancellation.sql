-- Run after kgp_qr_payments.sql. Execute the entire file in Supabase SQL Editor.
begin;
alter table public.orders add column if not exists cancellation_reason text;
alter table public.orders add column if not exists cancelled_at timestamptz;
alter table public.orders add column if not exists cancelled_by uuid;
alter table public.orders add column if not exists cancellation_requested_at timestamptz;
alter table public.orders add column if not exists cancellation_request_reason text;
alter table public.kgp_qr_payments add column if not exists gateway_cancelled_at timestamptz;

-- Service-only: the API confirms any issued QR is cancelled at KGP before calling this.
-- Recheck ownership/payment under locks to serialize with payment confirmation and QR creation.
drop function if exists public.cancel_customer_order(uuid, uuid, text);
create or replace function public.cancel_customer_order(
  p_order_id uuid, p_customer_id uuid, p_reason text, p_expected_reference text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  target_order public.orders%rowtype;
  payment public.payments%rowtype;
  qr public.kgp_qr_payments%rowtype;
begin
  p_reason := btrim(p_reason);
  if char_length(p_reason) < 3 or char_length(p_reason) > 200 then
    raise exception 'INVALID_CANCELLATION_REASON';
  end if;
  select * into target_order from public.orders
    where id = p_order_id and user_id = p_customer_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  select * into payment from public.payments where order_id = p_order_id for update;
  if not found or payment.customer_id is distinct from p_customer_id then
    raise exception 'PAYMENT_NOT_FOUND';
  end if;
  if payment.status not in ('pending', 'failed', 'cancelled') or payment.paid_at is not null
    or payment.provider_reference is not null then raise exception 'ORDER_ALREADY_PAID'; end if;
  if target_order.status = 'cancelled' then
    return jsonb_build_object('orderId', target_order.id, 'status', 'cancelled');
  end if;
  if coalesce(target_order.status, 'pending') not in ('pending', 'preparing', 'delivering') then
    raise exception 'ORDER_NOT_CANCELLABLE';
  end if;
  if payment.method not in ('cash', 'qr') then raise exception 'PAYMENT_METHOD_UNSUPPORTED'; end if;
  if payment.method = 'qr' then
    select * into qr from public.kgp_qr_payments where payment_id = payment.id for update;
    if found then
      if qr.reference_order is distinct from p_expected_reference then raise exception 'QR_CHANGED'; end if;
      if qr.gateway_cancelled_at is null then
        -- A known QR must be cancelled at KGP, even if its local clock says expired.
        if qr.qr_id is not null or qr.image_data_url is not null or qr.gateway_order_id is not null then
          raise exception 'QR_CANCEL_REQUIRED';
        end if;
        -- Failed authentication never issued a QR. Unknown creates must first expire.
        if qr.request_state <> 'failed' and qr.expires_at > now() then raise exception 'QR_CREATION_PENDING'; end if;
      end if;
    elsif p_expected_reference is not null then
      raise exception 'QR_CHANGED';
    end if;
  end if;
  update public.payments set status = 'cancelled', updated_at = now() where id = payment.id;
  update public.orders set status = 'cancelled', cancellation_reason = p_reason,
    cancelled_at = now(), cancelled_by = p_customer_id where id = target_order.id;
  return jsonb_build_object('orderId', target_order.id, 'status', 'cancelled');
end;
$$;
revoke all on function public.cancel_customer_order(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.cancel_customer_order(uuid, uuid, text, text) to service_role;
commit;
