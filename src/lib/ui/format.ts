export function money(v:number|string|null|undefined){
  return new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(Number(v??0));
}
export function hours(v:number|string|null|undefined){ return `${Number(v??0).toFixed(2)} h`; }
