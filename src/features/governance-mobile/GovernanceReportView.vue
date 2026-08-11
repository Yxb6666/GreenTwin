<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  createGovernanceIssue,
  listGovernanceIssues,
  type CreateGovernanceIssueRequest,
} from '@/api/governance'
import { useRuntimeConfig } from '@/config/useRuntimeConfig'
import LocationMapPreview from './LocationMapPreview.vue'
import {
  defaultGovernanceCategory,
  defaultGovernanceSubtype,
  extractTownSuggestions,
  fallbackLocation,
  getGovernanceSubtypes,
  governanceCategories,
  isGovernanceCategory,
  maxGovernancePhotos,
  recommendedPhotoBytes,
  validateGovernanceRequest,
  type GovernanceCategory,
  type GovernanceFormErrors,
} from './model'

interface SelectedPhoto {
  id: string
  file: File
  previewUrl: string
  mockUrl: string
  oversized: boolean
}

const router = useRouter()
const config = useRuntimeConfig()
const categoryOptions = Object.keys(governanceCategories) as GovernanceCategory[]
const form = reactive({
  type: defaultGovernanceCategory as GovernanceCategory,
  subtype: defaultGovernanceSubtype,
  description: '',
  town: '',
  village: '',
  longitude: null as number | null,
  latitude: null as number | null,
  contact: '',
  phone: '',
})
const errors = reactive<GovernanceFormErrors>({})
const photos = ref<SelectedPhoto[]>([])
const photoInput = ref<HTMLInputElement | null>(null)
const photoMessage = ref('')
const townSuggestions = ref<string[]>([])
const townLoadMessage = ref('')
const locating = ref(false)
const locationMode = ref<'idle' | 'real' | 'demo'>('idle')
const locationMessage = ref('点击定位以获取当前位置')
const submitting = ref(false)
const submitError = ref('')

const subtypeOptions = computed(() => getGovernanceSubtypes(form.type))
const descriptionCount = computed(() => form.description.length)

function onTypeChange(event: Event) {
  const value = (event.target as HTMLSelectElement).value
  if (!isGovernanceCategory(value)) return
  form.type = value
  form.subtype = getGovernanceSubtypes(value)[0] ?? ''
}

function openPhotoPicker() {
  photoInput.value?.click()
}

function createPhotoId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`
}

function onPhotoChange(event: Event) {
  const input = event.target as HTMLInputElement
  const selected = Array.from(input.files ?? [])
  const available = maxGovernancePhotos - photos.value.length
  const accepted = selected.slice(0, Math.max(0, available))
  if (selected.length > available)
    photoMessage.value = `最多上传 ${maxGovernancePhotos} 张，已保留前 ${Math.max(0, available)} 张`
  else photoMessage.value = ''

  accepted.forEach((file) => {
    const id = createPhotoId()
    photos.value.push({
      id,
      file,
      previewUrl: URL.createObjectURL(file),
      mockUrl: `mock://governance/images/${id}/${encodeURIComponent(file.name)}`,
      oversized: file.size > recommendedPhotoBytes,
    })
  })
  if (photos.value.some((photo) => photo.oversized))
    photoMessage.value = '部分图片超过建议的 5MB，Demo 仍允许继续提交'
  input.value = ''
}

function removePhoto(id: string) {
  const index = photos.value.findIndex((photo) => photo.id === id)
  if (index < 0) return
  URL.revokeObjectURL(photos.value[index]!.previewUrl)
  photos.value.splice(index, 1)
  photoMessage.value = photos.value.some((photo) => photo.oversized)
    ? '部分图片超过建议的 5MB，Demo 仍允许继续提交'
    : ''
}

function applyLocation(
  longitude: number,
  latitude: number,
  mode: 'real' | 'demo',
  message: string,
) {
  form.longitude = Number(longitude.toFixed(6))
  form.latitude = Number(latitude.toFixed(6))
  locationMode.value = mode
  locationMessage.value = message
  locating.value = false
  delete errors.location
}

function useFallbackLocation(reason: string) {
  applyLocation(
    fallbackLocation.longitude,
    fallbackLocation.latitude,
    'demo',
    `${reason}，已使用 Demo 模拟定位`,
  )
}

function requestLocation() {
  locating.value = true
  locationMessage.value = '正在获取当前位置…'
  if (!window.isSecureContext) {
    useFallbackLocation('当前页面不是安全连接，浏览器需要通过 HTTPS 获取真实位置')
    return
  }
  if (!navigator.geolocation) {
    useFallbackLocation('当前浏览器不支持定位')
    return
  }
  navigator.geolocation.getCurrentPosition(
    (position) =>
      applyLocation(
        position.coords.longitude,
        position.coords.latitude,
        'real',
        '定位成功',
      ),
    (error) => {
      const reason =
        error.code === error.PERMISSION_DENIED
          ? '定位权限被拒绝，请在浏览器或系统设置中允许本站使用位置'
          : error.code === error.POSITION_UNAVAILABLE
            ? '当前位置暂时不可用'
            : error.code === error.TIMEOUT
              ? '获取位置超时'
              : '未能获取真实位置'
      useFallbackLocation(reason)
    },
    { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
  )
}

function clearErrors() {
  Object.keys(errors).forEach((key) => delete errors[key as keyof GovernanceFormErrors])
}

function requestWithoutTime(): Omit<CreateGovernanceIssueRequest, 'time'> {
  return {
    type: form.type,
    subtype: form.subtype,
    description: form.description,
    images: photos.value.map((photo) => ({ url: photo.mockUrl })),
    town: form.town,
    village: form.village,
    longitude: form.longitude ?? Number.NaN,
    latitude: form.latitude ?? Number.NaN,
    contact: form.contact,
    phone: form.phone,
  }
}

async function submitReport() {
  clearErrors()
  submitError.value = ''
  const request = requestWithoutTime()
  Object.assign(errors, validateGovernanceRequest(request))
  if (Object.keys(errors).length) {
    document.querySelector<HTMLElement>('.gm-field-error')?.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    })
    return
  }

  submitting.value = true
  try {
    const response = await createGovernanceIssue(
      config.apiBaseUrl,
      config.requestTimeoutMs,
      {
        ...request,
        description: request.description.trim(),
        town: request.town.trim(),
        village: request.village.trim(),
        contact: request.contact.trim(),
        phone: request.phone.replace(/[\s-]/g, ''),
        time: new Date().toISOString(),
      },
    )
    await router.push({
      name: 'governance-mobile-success',
      params: { id: response.id },
    })
  } catch (cause) {
    submitError.value = cause instanceof Error ? cause.message : '提交失败，请稍后重试'
  } finally {
    submitting.value = false
  }
}

onMounted(async () => {
  try {
    townSuggestions.value = extractTownSuggestions(
      await listGovernanceIssues(config.apiBaseUrl, config.requestTimeoutMs),
    )
  } catch {
    townLoadMessage.value = '乡镇建议暂时不可用，仍可手动填写'
  }
})

onBeforeUnmount(() => {
  photos.value.forEach((photo) => URL.revokeObjectURL(photo.previewUrl))
})
</script>

<template>
  <main class="gm-page gm-report-page">
    <div class="gm-phone-canvas">
      <header class="gm-hero gm-report-hero">
        <button class="gm-back" type="button" aria-label="返回" @click="router.back()">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
        </button>
        <p class="gm-eyebrow">GREENTWIN · 乡村治理</p>
        <h1>问题上报</h1>
        <p>人人参与，共建美好家园</p>
        <div class="gm-landscape" aria-hidden="true">
          <i /><i /><i /><span /><b />
        </div>
      </header>

      <form class="gm-form-card" novalidate @submit.prevent="submitReport">
        <section class="gm-form-section">
          <h2><i />问题类型</h2>
          <label class="gm-label" for="issue-type">大类</label>
          <select id="issue-type" :value="form.type" @change="onTypeChange">
            <option v-for="type in categoryOptions" :key="type" :value="type">{{ type }}</option>
          </select>
          <label class="gm-label" for="issue-subtype">子类型</label>
          <select id="issue-subtype" v-model="form.subtype">
            <option v-for="subtype in subtypeOptions" :key="subtype" :value="subtype">
              {{ subtype }}
            </option>
          </select>
        </section>

        <section class="gm-form-section">
          <h2><i />问题描述 <em>*</em></h2>
          <div class="gm-textarea-wrap" :class="{ 'is-invalid': errors.description }">
            <textarea
              v-model="form.description"
              maxlength="200"
              placeholder="请输入您发现的问题情况（位置、现象等）"
              rows="5"
            />
            <span>{{ descriptionCount }}/200</span>
          </div>
          <p v-if="errors.description" class="gm-field-error">{{ errors.description }}</p>
        </section>

        <section class="gm-form-section">
          <h2><i />现场照片 <em>*</em><small>最多上传5张</small></h2>
          <input
            ref="photoInput"
            class="gm-visually-hidden"
            type="file"
            accept="image/*"
            multiple
            @change="onPhotoChange"
          />
          <div class="gm-photo-grid">
            <button
              v-if="photos.length < maxGovernancePhotos"
              class="gm-photo-add"
              type="button"
              @click="openPhotoPicker"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 8h3l1.5-2h7L17 8h3v11H4z" /><circle cx="12" cy="13" r="3.5" />
              </svg>
              <span>拍照/相册</span>
            </button>
            <figure v-for="photo in photos" :key="photo.id" class="gm-photo-thumb">
              <img :src="photo.previewUrl" :alt="photo.file.name" />
              <button type="button" aria-label="删除照片" @click="removePhoto(photo.id)">×</button>
              <figcaption v-if="photo.oversized">超过5MB</figcaption>
            </figure>
          </div>
          <p v-if="photoMessage" class="gm-field-hint is-warning">{{ photoMessage }}</p>
          <p v-if="errors.images" class="gm-field-error">{{ errors.images }}</p>
        </section>

        <section class="gm-form-section">
          <h2><i />位置信息 <em>*</em></h2>
          <div class="gm-location-banner" :class="`is-${locationMode}`">
            <span>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s6-5.2 6-12a6 6 0 1 0-12 0c0 6.8 6 12 6 12Z" /><circle cx="12" cy="9" r="2" /></svg>
              {{ locationMessage }}
            </span>
            <button type="button" :disabled="locating" @click="requestLocation">
              {{ locating ? '定位中' : form.longitude === null ? '获取定位' : '重新定位' }}
            </button>
          </div>
          <p v-if="errors.location" class="gm-field-error">{{ errors.location }}</p>
          <LocationMapPreview :longitude="form.longitude" :latitude="form.latitude" />
          <div class="gm-coordinate-grid">
            <label>经度<strong>{{ form.longitude?.toFixed(6) ?? '--' }}</strong></label>
            <label>纬度<strong>{{ form.latitude?.toFixed(6) ?? '--' }}</strong></label>
          </div>
          <div class="gm-two-columns">
            <label>
              <span class="gm-label">所属乡镇</span>
              <input
                v-model="form.town"
                list="town-suggestions"
                placeholder="请选择，如三义寨村"
                :class="{ 'is-invalid': errors.town }"
              />
              <datalist id="town-suggestions">
                <option v-for="town in townSuggestions" :key="town" :value="town" />
              </datalist>
              <small v-if="errors.town" class="gm-field-error">{{ errors.town }}</small>
            </label>
            <label>
              <span class="gm-label">所属村庄</span>
              <input
                v-model="form.village"
                placeholder="请输入，如葡萄架村"
                :class="{ 'is-invalid': errors.village }"
              />
              <small v-if="errors.village" class="gm-field-error">{{ errors.village }}</small>
            </label>
          </div>
          <p v-if="townLoadMessage" class="gm-field-hint is-warning">{{ townLoadMessage }}</p>
        </section>

        <section class="gm-form-section">
          <h2><i />联系人信息</h2>
          <label>
            <span class="gm-label">联系人</span>
            <input
              v-model="form.contact"
              autocomplete="name"
              placeholder="请输入联系人姓名"
              :class="{ 'is-invalid': errors.contact }"
            />
            <small v-if="errors.contact" class="gm-field-error">{{ errors.contact }}</small>
          </label>
          <label>
            <span class="gm-label">联系电话</span>
            <input
              v-model="form.phone"
              type="tel"
              inputmode="tel"
              autocomplete="tel"
              placeholder="请输入11位手机号码"
              :class="{ 'is-invalid': errors.phone }"
            />
            <small v-if="errors.phone" class="gm-field-error">{{ errors.phone }}</small>
          </label>
        </section>

        <p v-if="submitError" class="gm-submit-error" role="alert">{{ submitError }}</p>
        <button class="gm-primary-button" type="submit" :disabled="submitting">
          <span>{{ submitting ? '正在提交…' : '提交上报' }}</span>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
        </button>
        <p class="gm-privacy-note">您的信息仅用于本次问题核实与处置</p>
      </form>
    </div>
  </main>
</template>

<style src="./mobile.css"></style>
