import { onBeforeUnmount, onMounted, ref } from 'vue'

function formatDate(date: Date) {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

export function useClock() {
  const now = ref(formatDate(new Date()))
  let timer: number | undefined

  onMounted(() => {
    timer = window.setInterval(() => {
      now.value = formatDate(new Date())
    }, 1000)
  })

  onBeforeUnmount(() => window.clearInterval(timer))
  return now
}
