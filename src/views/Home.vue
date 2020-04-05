<template>
	<section class="hero">
		<div class="hero-body is-large">
			<div class="container">
				<h1 class="has-text-white-ter is-size-1 has-text-centered">
					Spectacle Interactif
				</h1>

				<div class="has-text-centered"><img src="@/assets/images/bird-shadow.jpg" /></div>

				<h2 class="has-text-centered">
					<router-link :to="'/show'">
						<h2 class="is-size-2">entrez ici</h2>
					</router-link>
				</h2>
			</div>
		</div>
	</section>
</template>

<script>
export default {
	name: 'Home',
};
</script>
<style scoped>
h2 {
	text-decoration: underline;
}
</style>
