<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import { useI18n } from 'vue-i18n'
import Button from 'primevue/button'
import Menu from 'primevue/menu'
import type { MenuItem } from 'primevue/menuitem'
import { setLocale } from '@/i18n'
import { localeOptions } from '@/i18n/locales'

const { t, locale } = useI18n({ useScope: 'global' })

const menu = ref<InstanceType<typeof Menu>>()
const menuId = useId()
const open = ref(false)

const items = computed<MenuItem[]>(() =>
  localeOptions().map(({ value, label }) => ({
    label,
    icon: value === locale.value ? 'pi pi-check' : undefined,
    command: () => {
      void setLocale(value)
    },
  })),
)

function toggle(event: Event) {
  menu.value?.toggle(event)
}
</script>

<template>
  <div class="locale-switcher">
    <Button
      type="button"
      icon="pi pi-globe"
      severity="secondary"
      text
      rounded
      :aria-label="t('a11y.localeSwitcher')"
      aria-haspopup="menu"
      :aria-controls="menuId"
      :aria-expanded="open"
      @click="toggle"
    />
    <Menu :id="menuId" ref="menu" :model="items" popup @show="open = true" @hide="open = false" />
  </div>
</template>

<style scoped>
.locale-switcher {
  display: flex;
  align-items: center;
}

/* Keep the icon legible against the gradient header. */
.locale-switcher :deep(.p-button.p-button-secondary.p-button-text) {
  color: rgb(255 255 255 / 90%);
}

.locale-switcher :deep(.p-button.p-button-secondary.p-button-text:hover) {
  color: #fff;
  background: rgb(255 255 255 / 15%);
}
</style>
