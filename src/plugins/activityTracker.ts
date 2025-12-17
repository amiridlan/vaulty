import type { App } from 'vue';
import { useAuthStore } from '../stores/auth';

export function activityTrackerPlugin(app: App) {
  let authStore: ReturnType<typeof useAuthStore>;

  // Initialize after app is mounted
  app.mixin({
    mounted() {
      if (!authStore) {
        authStore = useAuthStore();
      }
    }
  });

  // Track user activity
  const activityEvents = [
    'mousedown',
    'mousemove',
    'keypress',
    'scroll',
    'touchstart',
    'click'
  ];

  const handleActivity = () => {
    if (authStore && authStore.isAuthenticated) {
      authStore.updateActivity();
    }
  };

  // Add event listeners
  activityEvents.forEach(event => {
    document.addEventListener(event, handleActivity, true);
  });
}