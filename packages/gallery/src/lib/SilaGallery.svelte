<script lang="ts">
  export let label: string = 'Click me';
  function handleClick() {
    alert('SilaGallery button clicked');
  }
</script>

<button on:click={handleClick}>
  {label}
  </button>

