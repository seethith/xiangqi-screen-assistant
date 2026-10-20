import {detectBoards} from './vision-core.js';
self.onmessage=({data})=>{try{self.postMessage({id:data.id,boards:detectBoards(data.image)});}catch(e){self.postMessage({id:data.id,error:e.message});}};
