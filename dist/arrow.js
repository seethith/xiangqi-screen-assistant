import {arrowMarkup} from './arrow-geometry.js';
const update=s=>{document.querySelector('#arrow').innerHTML=s.arrow?arrowMarkup(s.arrow):'';};
window.desktopAPI.onSummary(update);update(await window.desktopAPI.getSummary());
