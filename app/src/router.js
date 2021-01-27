import Vue from 'vue';
import Router from 'vue-router';

import Show from '@/views/Show.vue';
import Home from '@/views/Home.vue';

Vue.use(Router);

const router = new Router({
	mode: 'history',
	base: process.env.BASE_URL,
	routes: [
		{
			path: '/',
			name: 'home',
			component: Home,
		},
		{
			path: '/show',
			name: 'show',
			component: Show,
		},
	],
});

export default router;
