'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { getMenuCategorySuggestions, getMenuCategoryToneClasses } from '@/lib/menu-categories'
import { getRestaurantTypeMeta } from '@/lib/restaurant-types'

interface Restaurant {
  id: string
  name: string
  restaurant_type: string | null
}

interface MenuCategory {
  id: string
  restaurant_id: string
  name: string
  created_at: string
}

export default function AdminMenuTagsPage() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [categories, setCategories] = useState<MenuCategory[]>([])
  const [selectedRestaurantId, setSelectedRestaurantId] = useState('')
  const [tagName, setTagName] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [setupMessage, setSetupMessage] = useState<string | null>(null)

  const fetchTags = useCallback(async () => {
    setLoading(true)
    setSetupMessage(null)

    try {
      const res = await fetch('/api/admin/menu-tags')
      const result = await res.json()

      if (!res.ok) {
        if (result.setupRequired) {
          setSetupMessage(result.error || 'ต้องรัน SQL สำหรับระบบ tag เมนูก่อน')
        }
        throw new Error(result.error || 'ไม่สามารถโหลด tag เมนูได้')
      }

      setRestaurants(result.restaurants || [])
      setCategories(result.categories || [])

      if (!selectedRestaurantId && result.restaurants?.[0]?.id) {
        setSelectedRestaurantId(result.restaurants[0].id)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'ไม่สามารถโหลด tag เมนูได้'
      console.error(message)
    } finally {
      setLoading(false)
    }
  }, [selectedRestaurantId])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchTags()
  }, [fetchTags])

  const selectedRestaurant = restaurants.find((restaurant) => restaurant.id === selectedRestaurantId) || null
  const selectedCategories = categories
    .filter((category) => category.restaurant_id === selectedRestaurantId)
    .filter((category) => category.name.toLowerCase().includes(searchTerm.toLowerCase()))
  const categorySuggestions = useMemo(() => {
    const existingNames = categories
      .filter((category) => category.restaurant_id === selectedRestaurantId)
      .map((category) => category.name.toLowerCase())

    return getMenuCategorySuggestions(selectedRestaurant?.restaurant_type)
      .filter((name) => !existingNames.includes(name.toLowerCase()))
  }, [categories, selectedRestaurant?.restaurant_type, selectedRestaurantId])
  const totalTags = categories.length

  const addTag = async (nameOverride?: string) => {
    const name = String(nameOverride || tagName).trim()
    if (!selectedRestaurantId) return alert('กรุณาเลือกร้านอาหารก่อน')
    if (!name) return alert('กรุณากรอกชื่อ tag')

    setSubmitting(true)
    try {
      const res = await fetch('/api/admin/menu-tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurant_id: selectedRestaurantId,
          name,
        }),
      })
      const result = await res.json()

      if (!res.ok) throw new Error(result.error || 'ไม่สามารถเพิ่ม tag ได้')

      if (result.category) {
        setCategories((current) => {
          const exists = current.some((category) => category.id === result.category.id)
          const nextCategories = exists
            ? current.map((category) => category.id === result.category.id ? result.category : category)
            : [...current, result.category]

          return nextCategories.sort((a, b) => a.name.localeCompare(b.name, 'th'))
        })
      }

      setTagName('')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'ไม่สามารถเพิ่ม tag ได้'
      alert(message)
    } finally {
      setSubmitting(false)
    }
  }

  const deleteTag = async (category: MenuCategory) => {
    if (!confirm(`ต้องการลบ tag "${category.name}" ใช่ไหม? เมนูที่ใช้ tag นี้จะกลับไปอยู่เมนูอื่นๆ`)) return

    setSubmitting(true)
    try {
      const res = await fetch('/api/admin/menu-tags', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: category.id }),
      })
      const result = await res.json()

      if (!res.ok) throw new Error(result.error || 'ไม่สามารถลบ tag ได้')

      setCategories((current) => current.filter((item) => item.id !== category.id))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'ไม่สามารถลบ tag ได้'
      alert(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-orange-500">Menu Tags</p>
          <h1 className="mt-1 text-3xl font-black text-white sm:text-4xl">จัดการ Tag เมนู</h1>
          <p className="mt-2 text-sm text-neutral-400">
            เพิ่มหมวดเมนูให้แต่ละร้าน เช่น น้ำอัดลม น้ำปั่น ชา กาแฟ หรือหมวดอาหารของร้าน
          </p>
        </div>
        <button
          type="button"
          onClick={fetchTags}
          disabled={loading}
          className="rounded-xl bg-orange-500 px-4 py-2 text-xs font-black text-black transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:bg-neutral-800 disabled:text-neutral-500"
        >
          รีเฟรชข้อมูล
        </button>
      </div>

      {setupMessage && (
        <div className="mb-5 rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4 text-sm font-bold text-amber-100">
          {setupMessage}
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
            <h2 className="text-sm font-black text-white">เลือกร้าน</h2>
            <select
              value={selectedRestaurantId}
              onChange={(event) => {
                setSelectedRestaurantId(event.target.value)
                setSearchTerm('')
              }}
              className="mt-3 w-full rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-3 text-sm font-bold text-white outline-none transition focus:border-orange-500"
            >
              <option value="">เลือกร้านอาหาร</option>
              {restaurants.map((restaurant) => (
                <option key={restaurant.id} value={restaurant.id}>
                  {restaurant.name}
                </option>
              ))}
            </select>

            {selectedRestaurant && (
              <div className="mt-3 rounded-xl border border-orange-500/20 bg-orange-500/10 p-3">
                <p className="text-xs font-bold text-neutral-400">รูปแบบร้าน</p>
                <p className="mt-1 text-sm font-black text-orange-300">
                  {getRestaurantTypeMeta(selectedRestaurant.restaurant_type).label}
                </p>
              </div>
            )}
          </div>

          <form
            onSubmit={(event) => {
              event.preventDefault()
              addTag()
            }}
            className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4"
          >
            <h2 className="text-sm font-black text-white">เพิ่ม Tag ใหม่</h2>
            <input
              type="text"
              value={tagName}
              onChange={(event) => setTagName(event.target.value.slice(0, 40))}
              placeholder="เช่น น้ำอัดลม, น้ำปั่น"
              className="mt-3 w-full rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-3 text-sm font-bold text-white placeholder-neutral-600 outline-none transition focus:border-orange-500"
            />
            <button
              type="submit"
              disabled={submitting || !selectedRestaurantId || !tagName.trim()}
              className="mt-3 w-full rounded-xl bg-orange-500 px-4 py-3 text-sm font-black text-black transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:bg-neutral-800 disabled:text-neutral-500"
            >
              เพิ่ม Tag
            </button>
          </form>

          <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-neutral-500">สรุป</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-3 text-center">
                <p className="text-2xl font-black text-orange-400">{restaurants.length}</p>
                <p className="text-[10px] font-bold text-neutral-500">ร้าน</p>
              </div>
              <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-3 text-center">
                <p className="text-2xl font-black text-sky-400">{totalTags}</p>
                <p className="text-[10px] font-bold text-neutral-500">tag ทั้งหมด</p>
              </div>
            </div>
          </div>
        </aside>

        <section className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-black text-white">
                {selectedRestaurant ? `Tag ของร้าน ${selectedRestaurant.name}` : 'Tag เมนู'}
              </h2>
              <p className="mt-1 text-sm text-neutral-500">ใช้ tag เพื่อแยกหมวดเมนูในหน้าลูกค้า</p>
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="ค้นหา tag..."
              className="w-full rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm font-bold text-white placeholder-neutral-600 outline-none transition focus:border-orange-500 sm:w-64"
            />
          </div>

          {categorySuggestions.length > 0 && (
            <div className="mt-5 rounded-2xl border border-sky-500/20 bg-sky-500/5 p-4">
              <p className="text-xs font-black uppercase tracking-wide text-sky-300">Tag แนะนำ</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {categorySuggestions.map((name) => (
                  <button
                    key={name}
                    type="button"
                    disabled={submitting || !selectedRestaurantId}
                    onClick={() => addTag(name)}
                    className="rounded-full border border-sky-500/25 bg-sky-500/10 px-3 py-1.5 text-xs font-black text-sky-200 transition hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    + {name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mt-5">
            {loading ? (
              <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-10 text-center text-sm font-bold text-orange-400">
                กำลังโหลด Tag...
              </div>
            ) : !selectedRestaurantId ? (
              <div className="rounded-2xl border border-dashed border-neutral-800 bg-neutral-950 p-10 text-center text-sm text-neutral-500">
                เลือกร้านก่อนเพื่อจัดการ tag
              </div>
            ) : selectedCategories.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-neutral-800 bg-neutral-950 p-10 text-center text-sm text-neutral-500">
                ยังไม่มี tag ในร้านนี้
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-3">
                {selectedCategories.map((category, index) => (
                  <div
                    key={category.id}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-neutral-800 bg-neutral-950 p-4"
                  >
                    <div className="min-w-0">
                      <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-black ${getMenuCategoryToneClasses(index)}`}>
                        {category.name}
                      </span>
                      <p className="mt-2 text-[11px] font-bold text-neutral-600">
                        สร้างเมื่อ {new Date(category.created_at).toLocaleDateString('th-TH')}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => deleteTag(category)}
                      className="rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2 text-xs font-black text-red-300 transition hover:bg-red-500/20 disabled:opacity-50"
                    >
                      ลบ
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
