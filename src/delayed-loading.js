export function createDelayedLoading({
  onChange,
  delayMs = 1_000,
  minVisibleMs = 300,
  setTimer = setTimeout,
  clearTimer = clearTimeout,
  now = Date.now,
}) {
  let activeRequests = 0
  let visibleAt = 0
  let delayTimer
  let hideTimer
  let isVisible = false

  function clearPendingTimer(timer) {
    if (timer !== undefined) clearTimer(timer)
  }

  function setVisible(visible) {
    isVisible = visible
    onChange(visible)
  }

  function begin() {
    activeRequests += 1
    clearPendingTimer(hideTimer)
    hideTimer = undefined

    if (activeRequests === 1 && !isVisible) {
      delayTimer = setTimer(() => {
        delayTimer = undefined
        if (activeRequests === 0) return
        visibleAt = now()
        setVisible(true)
      }, delayMs)
    }

    let ended = false
    return () => {
      if (ended) return
      ended = true
      activeRequests -= 1
      if (activeRequests > 0) return

      clearPendingTimer(delayTimer)
      delayTimer = undefined

      if (!isVisible) return

      const remainingVisibleTime = Math.max(0, minVisibleMs - (now() - visibleAt))
      hideTimer = setTimer(() => {
        hideTimer = undefined
        if (activeRequests === 0 && isVisible) setVisible(false)
      }, remainingVisibleTime)
    }
  }

  return { begin }
}
