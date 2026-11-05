// Refresh business data without remounting the panel or discarding draft inputs.
export function refreshOnTick(load = panel => panel.load()) {
 return {
  props: {refreshTick: {type: Number, default: 0}},
  data() { return {panelRefreshPending: false, panelRefreshRunning: false} },
  watch: {
   refreshTick() { this.refreshPanelData() },
   busy(value) { if (!value && this.panelRefreshPending && !this.panelRefreshRunning) this.refreshPanelData() },
   loading(value) { if (!value && this.panelRefreshPending && !this.panelRefreshRunning) this.refreshPanelData() }
  },
  beforeUnmount() { this._panelRefreshDisposed = true; this.panelRefreshPending = false },
  methods: {
   async refreshPanelData() {
    if (this._panelRefreshDisposed) return
    this.panelRefreshPending = true
    if (this.busy || this.loading || this.panelRefreshRunning) return
    this.panelRefreshRunning = true
    try {
     while (this.panelRefreshPending && !this.busy && !this.loading && !this._panelRefreshDisposed) {
      this.panelRefreshPending = false
      await load(this)
     }
    } finally { this.panelRefreshRunning = false }
   }
  }
 }
}
