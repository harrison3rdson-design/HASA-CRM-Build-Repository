export function money(v:number|string|null|undefined){
  return new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(Number(v??0));
}
export function hours(v:number|string|null|undefined){ return `${Number(v??0).toFixed(2)} h`; }
export function dateTime(v:string|null|undefined){
  if(!v) return "—";
  return new Intl.DateTimeFormat("en-US",{
    timeZone:"America/New_York",year:"numeric",month:"short",day:"numeric",
    hour:"numeric",minute:"2-digit",timeZoneName:"short"
  }).format(new Date(v));
}
