import { useCallback, useEffect, useState } from 'react';
export function useResource<T>(loader:()=>Promise<T>,deps:unknown[]=[]){
 const [data,setData]=useState<T|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const refresh=useCallback(async()=>{setLoading(true);setError('');try{setData(await loader());}catch{setError('We could not load this workspace data.');}finally{setLoading(false);}},deps);
 useEffect(()=>{void refresh();},[refresh]);
 return {data,loading,error,refresh,setData};
}
