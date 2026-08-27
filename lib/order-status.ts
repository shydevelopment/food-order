export type OrderStatus ='pending' |'preparing' |'delivering' |'completed' |'cancelled'

export const allowedOrderStatuses: OrderStatus[] = ['pending','preparing','delivering','completed','cancelled']

export const activeOrderStatuses: OrderStatus[] = ['pending','preparing','delivering']

export const orderStatusMeta: Record<OrderStatus, {
 label: string
 adminTabLabel: string
 customerDetail: string
 notificationLabel: string
 tone:'orange' |'emerald' |'sky'
 className: string
}> = {
 pending: {
 label:'รอร้านรับออเดอร์',
 adminTabLabel:'รอรับออเดอร์',
 customerDetail:'ร้านได้รับออเดอร์แล้ว กำลังรอยืนยัน',
 notificationLabel:'รอร้านรับออเดอร์',
 tone:'orange',
 className:'border-amber-500/30 bg-amber-500/10 text-amber-400',
 },
 preparing: {
 label:'กำลังเตรียมอาหาร',
 adminTabLabel:'กำลังเตรียม',
 customerDetail:'ร้านเริ่มทำอาหารให้แล้ว',
 notificationLabel:'ร้านกำลังเตรียมอาหาร',
 tone:'sky',
 className:'border-blue-500/30 bg-blue-500/10 text-blue-400',
 },
 delivering: {
 label:'พร้อมให้มารับอาหาร',
 adminTabLabel:'พร้อมรับอาหาร',
 customerDetail:'สามารถไปรับอาหารที่ร้านได้ตามเวลาที่เลือก',
 notificationLabel:'อาหารพร้อมให้มารับแล้ว',
 tone:'emerald',
 className:'border-purple-500/30 bg-purple-500/10 text-purple-400',
 },
 completed: {
 label:'สำเร็จแล้ว',
 adminTabLabel:'เสร็จสิ้น',
 customerDetail:'รับอาหารเรียบร้อยแล้ว ขอบคุณที่ใช้บริการ',
 notificationLabel:'ออเดอร์เสร็จสิ้น',
 tone:'emerald',
 className:'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
 },
 cancelled: {
 label:'ยกเลิก',
 adminTabLabel:'ยกเลิก',
 customerDetail:'ออเดอร์นี้ถูกยกเลิกแล้ว',
 notificationLabel:'ออเดอร์ถูกยกเลิก',
 tone:'orange',
 className:'border-red-500/30 bg-red-500/10 text-red-400',
 },
}

export const normalizeOrderStatus = (status: string | null | undefined): OrderStatus => (
 allowedOrderStatuses.includes(status as OrderStatus) ? status as OrderStatus :'pending'
)

export const getOrderStatusLabel = (status: string | null | undefined) => (
 orderStatusMeta[normalizeOrderStatus(status)].label
)

export const getOrderStatusNotificationLabel = (status: string | null | undefined) => (
 orderStatusMeta[normalizeOrderStatus(status)].notificationLabel
)

export const getOrderStatusDetail = (status: string | null | undefined) => (
 orderStatusMeta[normalizeOrderStatus(status)].customerDetail
)

export const getOrderStatusStyle = (status: string | null | undefined) => (
 orderStatusMeta[normalizeOrderStatus(status)].className
)

export const getOrderStatusTone = (status: string | null | undefined) => (
 orderStatusMeta[normalizeOrderStatus(status)].tone
)

export const isActiveOrderStatus = (status: string | null | undefined) => (
 activeOrderStatuses.includes(normalizeOrderStatus(status))
)

export const getOrderStatusNotificationKey = (orderId: string, status: string | null | undefined) => (
 `order-status-${orderId}-${normalizeOrderStatus(status)}`
)
