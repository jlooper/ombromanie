<template>
  <div class="hello">
    <img src="@/assets/images/bird-shadow.jpg" />
    <router-link :to="'/show'">
      <h2>Spectacle Interactif</h2>
    </router-link>
  </div>
</template>

<script>
export default {
  name: "Home"
};
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style>
h1 {
  font-size: 4em;
}
h2 {
  margin: 40px 0 0;
  font-size: 3.5em;
}
</style>
