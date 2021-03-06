import * as _ from "lodash"

interface BoundWorkerClass {
    new (): Worker
}

interface WrappedWorker {
    busy: string,
    worker: Worker
}

interface WorkerTask {
    type: string,
    content: any,
    transferList?: any[]
}

export class WorkerPool {
    workers: WrappedWorker[] = []
    taskQueue: WorkerTask[] = []
    constructor(workerClass: BoundWorkerClass, size: number = 1) {
        for (let i = 0; i < size; i++) {
            this.workers.push({
                busy: undefined,
                worker: new workerClass()
            })
        }
        if (!this.oneWorker()) {
            this.workers.forEach(w => {
                w.worker.addEventListener("message", ({data}) => {
                    this.onWorkerMessage(w, data.type)
                })
            })
        }
    }
    onWorkerMessage = (worker: WrappedWorker, type: string) => {
        if (type == worker.busy) {
            worker.busy = undefined
        }
        if (this.taskQueue.length > 0) {
            let {type, content, transferList} = this.taskQueue.shift()
            this.post(type, content, transferList)
        }
    }
    poolSize() {
        return this.workers.length
    }
    oneWorker() {
        return this.poolSize() == 1
    }
    post(type: string, content?: any, transferList?: any[]) {
        if (this.oneWorker()) {
            this.workers[0].worker.postMessage({type, content}, transferList)
            return;
        }
        let freeWorker = _.find(this.workers, w => !w.busy)
        if (freeWorker) {
            freeWorker.worker.postMessage({ type, content }, transferList)
            freeWorker.busy = type
        }
        else {
            this.taskQueue.push({ type, content, transferList })
        }
    }
    listen(callbacks: {[key: string]: Function}) {
        this.workers.forEach(w => {
            w.worker.addEventListener("message", ({data}) => {
                //if (!w.busy || this.oneWorker()) {
                    for (let key in callbacks) {
                        if (data.type == key) {
                            callbacks[key](data.content)
                        }
                    }
                //}
                /*
                _.forOwn(callbacks, (callback, key) => {
                    if (data.type == key) {
                        callback(data.content)
                    }
                })
                */
            })
        })
    }
    terminate() {
        this.workers.forEach(w => {
            w.worker.terminate()
        })
    }
}