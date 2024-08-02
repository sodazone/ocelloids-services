export interface CancelablePromise<T> extends Promise<T> {
  cancel(): CancelablePromise<T>
}

function cancelable(promise: Promise<void>, onCancel?: () => void): CancelablePromise<void> {
  let cancel: (() => CancelablePromise<void>) | null = null
  let cancelable: CancelablePromise<void>
  cancelable = <CancelablePromise<void>>new Promise((resolve, reject) => {
    cancel = () => {
      try {
        if (onCancel) {
          onCancel()
          resolve()
        }
      } catch (e) {
        reject(e)
      }
      return cancelable
    }
    promise.then(resolve, reject)
  })
  if (cancel) {
    cancelable.cancel = cancel
  }
  return cancelable
}

export function delay(ms: number) {
  let timer: NodeJS.Timeout
  return cancelable(
    new Promise((resolve) => {
      timer = setTimeout(resolve, ms)
      timer.unref()
    }),
    () => {
      clearTimeout(timer)
    },
  )
}
