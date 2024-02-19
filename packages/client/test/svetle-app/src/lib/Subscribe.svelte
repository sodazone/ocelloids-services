<script lang="ts">
  import { onMount } from "svelte";
  import { createSubscriptionStore } from "../store";

  let messages: string[] = [];
  let store: any;

  async function connect() {
    store = await createSubscriptionStore();

    store.subscribe((msgs: any) => {
      messages = msgs;
    });
  }

  onMount(() => {
    return () => console.log("On destroy...");
  });
</script>

{#await connect() then}
  <div class="messages">
    {#each messages as m}
      <pre>{m}</pre>
    {/each}
  </div>
  <div class="footer">{messages.length} msgs</div>
{/await}

<style>
  .messages {
    background-color: rgba(60, 60, 60, 0.5);
    overflow: auto;
    width: 80rem;
    max-height: 90vh;
    border-radius: 1rem;
  }

  .messages pre {
    border-bottom: 1px solid #111;
    padding: 1rem;
    white-space: pre-wrap;
    word-wrap: break-word;
  }

  .messages pre:last-child {
    border-bottom: 0;
  }

  .footer {
    margin: 0.5rem 1rem;
    float: right;
  }
</style>
