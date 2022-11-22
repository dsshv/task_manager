import { KeeperDto } from "databaseProviders";

const secMs = 1000;
const minMs = 60 * secMs;
const hourMs = 60 * minMs;

const RECALC_EARNINGS_INTERVAL_MS = hourMs;

const RUBLES_PER_HOUR_PER_GB = 0.0002

const byte = 8;
const kb = 1024 * byte;
const mb = 1024 * kb;
const gb = 1024 * mb;

/**
 * 
 * @param keeper - документ кипера
 * @returns данные для обновления
 */
function calculateKeeperEarnings(keeper: KeeperDto): Partial<KeeperDto> {
    const currentDateMs = new Date().getTime();
    const onlineDateMs = new Date(keeper.onlineDate).getTime();
    const recalcDateMs = new Date(keeper.earnings.accuralDate).getTime();

    let resultEarningsRUB = keeper.earnings.earnings_RUB;
    let isRecalculated: boolean = false;
    
    //Если пора пересчитать заработок
    if(currentDateMs - recalcDateMs >= RECALC_EARNINGS_INTERVAL_MS) {
        if(currentDateMs - onlineDateMs > hourMs) {
            resultEarningsRUB += Math.floor(keeper.space / gb) * RUBLES_PER_HOUR_PER_GB;
        }
        isRecalculated = true;
    }

    let result = {
        earnings: {
            earnings_RUB: resultEarningsRUB,
            accuralDate: keeper.earnings.accuralDate
        }
    } as KeeperDto;

    if(isRecalculated) result.earnings.accuralDate = new Date().toISOString();

    return result;
}

export { calculateKeeperEarnings };