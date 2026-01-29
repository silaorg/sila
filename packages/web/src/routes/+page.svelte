<script lang="ts">
	import { ClientState, SilaApp, type ClientStateConfig } from "@sila/client";

	const config: ClientStateConfig = {
		initState: new ClientState(),
	};
</script>

<SilaApp {config} />
