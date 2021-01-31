<template>
  <div>
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
    Nav,
  },
};
</script>

<style>
html {
  background-color: black;
}
</style>
