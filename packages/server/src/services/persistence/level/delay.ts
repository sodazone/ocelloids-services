export interface CancelablePromise<T> extends Promise<T> {
  cancel(): CancelablePromise<T>
}

function cancelable<T>(promise: Promise<T>, onCancel?: () => void): CancelablePromise<T> {
  let cancel: (() => CancelablePromise<T>) | null = null
  let cancelable: CancelablePromise<T>
  cancelable = <CancelablePromise<T>>new Promise((resolve, reject) => {
    cancel = () => {
      try {
        if (onCancel) {
          onCancel()
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

export function empty() {
  return cancelable<void>(Promise.resolve())
}

export function delay(ms: number) {
  let timer: any
  return cancelable<void>(
    new Promise((resolve) => {
      timer = setTimeout(resolve, ms)
    }),
    () => {
      clearTimeout(timer)
    },
  )
}
