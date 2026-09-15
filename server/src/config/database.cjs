require('dotenv').config({path:require('path').resolve(process.cwd(),'../.env')});
const base={username:process.env.DB_USER||'root',password:process.env.DB_PASSWORD||null,database:process.env.DB_NAME||'high_street_db',host:process.env.DB_HOST||'127.0.0.1',port:Number(process.env.DB_PORT||3306),dialect:'mysql',logging:false};
module.exports={development:base,test:{...base,database:`${base.database}_test`},production:{...base,ssl:process.env.DB_SSL==='true'?{require:true,rejectUnauthorized:false}:undefined}};
