import Vue from 'vue';
import App from './App.vue';
import router from './router';
import AudioRecorder from 'vue-audio-recorder';

Vue.use(AudioRecorder);
Vue.config.productionTip = false;

new Vue({
	router,
	render: (h) => h(App),
}).$mount('#app');
