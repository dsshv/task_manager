import { Worker, parentPort, isMainThread } from "worker_threads";
import WorkerMessageInstance from "../../taskManager/task/messages/workerMessage";
import { KeeperEarningEnv } from "../../ts/interfaces";
import { MainThreadMessage, WorkerMessage } from "../../ts/types";
import { KeeperProvider } from "databaseProviders";
import {DefaultAdmin} from "services";
import { databaseInit } from "databaseProviders/lib/database/databaseConnection";
import { calculateKeeperEarnings } from "./instruments";


/******************************************************************
_______________________PUT YOUR CODE HERE__________________________

!!!WARNING: it is not recommended to use infinite/very long loops
without using asynchronous operations in the body of the loop.  
Otherwise, the operations of receiving messages from the main 
stream may be blocked.

Some usefull functions:

* log() - use as console.log; console.log may not work correctly.

* updateTaskInfo() - the function updates the task information in 
the main thread. You can use it for information about internal
variables, for example, how many collection items have already 
been processed in the database. It is highly recommended 
to determine in advance the type of data that you will update 
and hold to it for any update of information within this task.

*******************************************************************/

const NUM_OF_KEEPERS_PER_ITERATION = 10;

async function main(): Promise<void> {
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

    const req = await DefaultAdmin.getReqOptions();
    if (!req) {
        console.log('CANNOT GET DEFAULT ADMIN OPTIONS')
        return
    }
    const database = await databaseInit();
    const keeperProvider = new KeeperProvider({database});

    let env: KeeperEarningEnv = {
        keepersCount: 0,
        currentKeeperCount: 0,
        numOfKeepersPerIteration: NUM_OF_KEEPERS_PER_ITERATION
    };

    main_loop: while(true) {

        updateTaskInfo({env});

        env.keepersCount = await keeperProvider.count({
            online: 1
        });
        if(!env.keepersCount) return;

        while (env.currentKeeperCount < env.keepersCount) {
            const keepers = await keeperProvider.find(
                {
                    online: 1
                }, 
                {
                    onlineDate: true,
                    earnings: true,
                    space: true
                },
                null,
                {
                    skip: env.currentKeeperCount, 
                    limit: env.numOfKeepersPerIteration
                }
            );

            if(keepers.length == 0) {
                const msg = 'KEEPER LENGTH IS 0';
                log(msg);
                env.currentKeeperCount = 0;
                continue main_loop;
            }

            for (const keeper of keepers) {
                const updatedKeeperData = calculateKeeperEarnings(keeper);
        
                const updateStatus = await keeperProvider.updateOne(
                    { _id: keeper.id }, 
                    updatedKeeperData
                );
        
                if(!updateStatus) console.log(`Keeper ${keeper.id} is not updated`);
            }

            env.currentKeeperCount += env.numOfKeepersPerIteration;

            updateTaskInfo({env});
            log(`KeeperEarning env:\n${env}`);
            await sleep(500);
        }
    }
}


/******************************************************************
_______________TECHNICAL CODE FOR THE TASK MANAGER_________________

           !!!WARNING: DO NOT CHANGE THE CODE BELOW!!!

*******************************************************************/        



try {
    // Cant run file as main thread
    if(!parentPort) throw new Error('Parent thread is not defined');

    // Receive message from main thread
    parentPort.on('message', (msg: MainThreadMessage) => {
        
    })

    main()
        .catch((err) => {
            log('WORKER ERROR \n' + err);
            process.exit(1);
        })
        .then(() => {
            process.exit(0);
        });

} catch(err) {
    log('WORKER ERROR \n' + err);
    process.exit(1);
}

//----------------USEFULL FUNCTIONS-----------------

function log(msg: unknown) {
    if(!parentPort) throw new Error('Parent thread is not defined');
    const message = new WorkerMessageInstance('log');
    message.data = msg;
    parentPort.postMessage(message);
}

function updateTaskInfo(data: object) {
    if(!parentPort) throw new Error('Parent thread is not defined');
    const message = new WorkerMessageInstance('taskInfo');
    message.data = data;
    parentPort.postMessage(message);
}





