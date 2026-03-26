<script setup lang="ts">
import { ref, onMounted } from 'vue'
import api from '@/utils/api'
import type { PaymentMethod } from '@/types'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import BaseConfirm from '@/components/ui/BaseConfirm.vue'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const methods = ref<PaymentMethod[]>([])
const loading = ref(true)
const showForm = ref(false)
const editing = ref<PaymentMethod | null>(null)
const saving = ref(false)
const deleteTarget = ref<string | null>(null)
const deleting = ref(false)

const form = ref({ type: 'bank_transfer' as string, name: '', configJson: '', isDefault: false, qrFile: null as File | null })
const uploadingQr = ref(false)
const qrPreview = ref<string | null>(null)

function onQrSelected(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    toast.error('Ảnh QR chỉ hỗ trợ JPEG, PNG, WebP')
    return
  }
  if (file.size > 5 * 1024 * 1024) {
    toast.error('Ảnh QR tối đa 5MB')
    return
  }
  form.value.qrFile = file
  qrPreview.value = URL.createObjectURL(file)
}

async function fetchMethods() {
  try {
    const res = await api.get('/admin/payment-methods')
    methods.value = res.data.methods ?? res.data.data ?? res.data
  } catch { /* */ } finally { loading.value = false }
}

function openCreate() {
  editing.value = null
  form.value = { type: 'bank_transfer', name: '', configJson: '{\n  "bankName": "",\n  "accountNo": "",\n  "accountName": ""\n}', isDefault: false, qrFile: null }
  qrPreview.value = null
  showForm.value = true
}

function openEdit(m: PaymentMethod) {
  editing.value = m
  form.value = { type: m.type, name: m.name, configJson: JSON.stringify(m.config, null, 2), isDefault: m.isDefault, qrFile: null }
  qrPreview.value = (m.config as any)?.qrImageKey ? `${import.meta.env.VITE_CDN_URL || ''}/${(m.config as any).qrImageKey}` : null
  showForm.value = true
}

async function save() {
  saving.value = true
  try {
    let parsedConfig: any
    try {
      parsedConfig = JSON.parse(form.value.configJson)
    } catch {
      toast.error('Config JSON không hợp lệ, vui lòng kiểm tra lại')
      saving.value = false
      return
    }

    // Upload QR image if selected
    if (form.value.qrFile) {
      uploadingQr.value = true
      try {
        const reader = new FileReader()
        const base64 = await new Promise<string>((resolve) => {
          reader.onload = () => {
            const result = reader.result as string
            resolve(result.split(',')[1]) // strip data:mime;base64, prefix
          }
          reader.readAsDataURL(form.value.qrFile!)
        })
        const { data } = await api.post('/admin/payment-methods/upload-qr', {
          mimeType: form.value.qrFile.type,
          data: base64,
        })
        parsedConfig.qrImageKey = data.key
      } finally {
        uploadingQr.value = false
      }
    }

    const body = { type: form.value.type, name: form.value.name, config: parsedConfig, isDefault: form.value.isDefault }
    if (editing.value) {
      await api.patch(`/admin/payment-methods/${editing.value.id}`, body)
    } else {
      await api.post('/admin/payment-methods', body)
    }
    showForm.value = false
    await fetchMethods()
    toast.success('Lưu thành công')
  } catch { toast.error('Lưu thất bại') }
  finally { saving.value = false }
}

async function deleteMethod() {
  if (!deleteTarget.value) return
  deleting.value = true
  try {
    await api.delete(`/admin/payment-methods/${deleteTarget.value}`)
    methods.value = methods.value.filter((m) => m.id !== deleteTarget.value)
    deleteTarget.value = null
    toast.success('Xóa thành công')
  } catch { toast.error('Xóa thất bại') }
  finally { deleting.value = false }
}

onMounted(fetchMethods)
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Phương thức thanh toán</h1>
      <BaseButton @click="openCreate">Thêm phương thức</BaseButton>
    </div>
    <div class="space-y-3">
      <div v-for="m in methods" :key="m.id" class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 flex items-center justify-between">
        <div>
          <div class="flex items-center gap-2">
            <h3 class="font-medium text-gray-900 dark:text-white">{{ m.name }}</h3>
            <BaseBadge>{{ m.type }}</BaseBadge>
            <BaseBadge v-if="m.isDefault" variant="orange">Mặc định</BaseBadge>
          </div>
          <pre class="text-xs text-gray-500 dark:text-gray-400 mt-1">{{ JSON.stringify(m.config, null, 2).slice(0, 100) }}...</pre>
        </div>
        <div class="flex gap-2">
          <BaseButton size="sm" variant="secondary" @click="openEdit(m)">Sửa</BaseButton>
          <BaseButton size="sm" variant="ghost" class="!text-red-500" @click="deleteTarget = m.id">Xóa</BaseButton>
        </div>
      </div>
    </div>

    <BaseModal :show="showForm" :title="editing ? 'Sửa phương thức' : 'Thêm phương thức'" max-width="lg" @close="showForm = false">
      <form @submit.prevent="save" class="space-y-4">
        <div><label class="block text-sm font-medium mb-1 dark:text-gray-300">Loại</label>
          <select v-model="form.type" class="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700 dark:text-white">
            <option value="bank_transfer">Chuyển khoản</option>
            <option value="momo">MoMo</option>
            <option value="zalopay">ZaloPay</option>
            <option value="cash">Tiền mặt</option>
          </select>
        </div>
        <div><label class="block text-sm font-medium mb-1 dark:text-gray-300">Tên hiển thị</label><input v-model="form.name" class="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700 dark:text-white" /></div>
        <div><label class="block text-sm font-medium mb-1 dark:text-gray-300">Config (JSON)</label><textarea v-model="form.configJson" rows="5" class="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-sm font-mono dark:bg-gray-700 dark:text-white" /></div>
        <div>
          <label class="block text-sm font-medium mb-1 dark:text-gray-300">Ảnh QR</label>
          <div class="flex items-center gap-4">
            <img v-if="qrPreview" :src="qrPreview" class="w-32 h-32 object-contain border rounded-lg" alt="QR" />
            <div>
              <input type="file" accept="image/jpeg,image/png,image/webp" class="text-sm" @change="onQrSelected" />
              <p class="text-xs text-gray-400 dark:text-gray-500 mt-1">JPEG, PNG, WebP. Tối đa 2MB</p>
            </div>
          </div>
        </div>
        <label class="flex items-center gap-2 text-sm"><input v-model="form.isDefault" type="checkbox" /> Mặc định</label>
        <div class="flex justify-end gap-3">
          <BaseButton variant="secondary" type="button" @click="showForm = false">Hủy</BaseButton>
          <BaseButton type="submit" :loading="saving">Lưu</BaseButton>
        </div>
      </form>
    </BaseModal>

    <BaseConfirm :show="!!deleteTarget" title="Xóa phương thức" message="Phương thức sẽ bị xóa vĩnh viễn." :loading="deleting" @confirm="deleteMethod" @cancel="deleteTarget = null" />
  </div>
</template>
