<template>
  <div id="scatter-gl-container">
    <Nav />
    <div class="wrapper">
      <router-view />
    </div>
  </div>
</template>

<script>
import Nav from "@/components/Nav";

export default {
  name: "App",
  components: {
    Nav
  }
};
</script>

<style>
#app {
  font-family: Great Victorian Standard, sans-serif;
}
body {
  background-color: black;
}
</style>
