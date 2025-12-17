import { createApp } from 'vue';
import './style.css';
import App from './App.vue';
import { pinia } from './stores';
import { activityTrackerPlugin } from './plugins/activityTracker';

const app = createApp(App);

app.use(pinia);
app.use(activityTrackerPlugin);

app.mount('#app');