// Monday 9 November 2026, 09:00 America/Los_Angeles. The one deadline to edit.
export const LIVE_MODE_UNTIL = '2026-11-09T17:00:00Z';
export function hackLiveMode(override='auto',now=Date.now()){
 const mode=['on','off','auto'].includes(override)?override:'auto';
 return{mode,until:LIVE_MODE_UNTIL,enabled:mode==='on'||(mode==='auto'&&now<Date.parse(LIVE_MODE_UNTIL)),serverTime:now};
}
