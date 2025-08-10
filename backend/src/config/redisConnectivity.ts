import Redis from 'ioredis';
const redis = new Redis();
redis.on('connect', ()=>{
    console.log("redis connected successfully");
})
redis.on('error', (err)=>{
    console.log("redis error: ", err);
})
export default redis;