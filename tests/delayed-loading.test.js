import assert from 'node:assert/strict'
import test from 'node:test'
import { createDelayedLoading } from '../src/delayed-loading.js'

function createFakeClock() {
  let currentTime = 0
  let nextTimerId = 0
  const timers = new Map()

  function setTimer(callback, delay) {
    const id = ++nextTimerId
    timers.set(id, { callback, at: currentTime + delay })
    return id
  }

  function clearTimer(id) {
    timers.delete(id)
  }

  function advanceBy(duration) {
    const targetTime = currentTime + duration
    while (true) {
      const next = [...timers.entries()]
        .filter(([, timer]) => timer.at <= targetTime)
        .sort(([, first], [, second]) => first.at - second.at)[0]
      if (!next) break
      const [id, timer] = next
      currentTime = timer.at
      timers.delete(id)
      timer.callback()
    }
    currentTime = targetTime
  }

  return { now: () => currentTime, setTimer, clearTimer, advanceBy }
}

function createTestLoading(clock, changes) {
  return createDelayedLoading({
    onChange: (visible) => changes.push({ at: clock.now(), visible }),
    now: clock.now,
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
  })
}

test('does not show for requests that finish before one second', () => {
  const clock = createFakeClock()
  const changes = []
  const loading = createTestLoading(clock, changes)
  const finish = loading.begin()

  clock.advanceBy(999)
  finish()
  clock.advanceBy(1_000)

  assert.deepEqual(changes, [])
})

test('shows after one second and remains visible for at least 300 ms', () => {
  const clock = createFakeClock()
  const changes = []
  const loading = createTestLoading(clock, changes)
  const finish = loading.begin()

  clock.advanceBy(1_000)
  assert.deepEqual(changes, [{ at: 1_000, visible: true }])

  clock.advanceBy(299)
  finish()
  assert.deepEqual(changes, [{ at: 1_000, visible: true }])

  clock.advanceBy(1)
  assert.deepEqual(changes, [
    { at: 1_000, visible: true },
    { at: 1_300, visible: false },
  ])
})

test('keeps the indicator active until all overlapping requests finish', () => {
  const clock = createFakeClock()
  const changes = []
  const loading = createTestLoading(clock, changes)
  const finishFirst = loading.begin()

  clock.advanceBy(500)
  const finishSecond = loading.begin()
  clock.advanceBy(500)
  assert.deepEqual(changes, [{ at: 1_000, visible: true }])

  finishFirst()
  clock.advanceBy(200)
  assert.deepEqual(changes, [{ at: 1_000, visible: true }])

  finishSecond()
  clock.advanceBy(99)
  assert.deepEqual(changes, [{ at: 1_000, visible: true }])

  clock.advanceBy(1)
  assert.deepEqual(changes, [
    { at: 1_000, visible: true },
    { at: 1_300, visible: false },
  ])
})
