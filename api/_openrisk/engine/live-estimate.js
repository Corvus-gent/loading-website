import { estimate } from './score.js';
import { engineering, hiring, identify, signal } from './enrich.js';

const missing = {
  founded:'A founding year from a company page or registry.',
  funding:'A dated funding announcement or closing record.',
  jobs:'Current vacancies from an attributable careers board.',
  github:'A public GitHub organization linked to the company.',
};
const domain = url => url ? new URL(url).hostname.replace(/^www\./,'') : '';

export async function runEstimate(item, emit) {
  emit({key:'plan',factors:Object.keys(missing).length});
  const signals={...item.signals};
  const trustup=item.id==='trustup';
  const board=trustup?'trustup-careers:trustup':item.board;
  emit({key:'step',title:'Load existing evidence',detail:'Public signals already linked to '+item.name+' are the starting point.'});

  if (trustup) {
    const verifiedAt='2026-11-18T00:00:00Z';
    signals.founded=signal(2017,'https://trustup-group.com/histoire/','scraped','medium',verifiedAt);
    signals.funding=signal({label:'€5M announced',announced:'2025-01-16'},
      'https://noshaq.be/wp-content/uploads/2025/01/20250116_CP_Trustup-leve-5-millions-.pdf','scraped','medium',verifiedAt);
    emit({key:'step',title:'Load Trustup’s primary sources',detail:'Company history and the dated investor press release.'});
  }

  const check=async (key,title,lookup)=>{
    emit({key:'step',title,detail:'Checking the public source…'});
    try {
      const observed=await lookup();
      if (observed) signals[key]=observed;
      emit({key:'step',title,detail:observed?'Found attributable evidence.':'No attributable result returned.',signal:observed});
    } catch {
      emit({key:'step',title,detail:'Source unavailable. Existing evidence kept if present.'});
    }
  };

  await Promise.all([
    board ? check('jobs','Check the careers board',()=>hiring(board))
      : Promise.resolve(emit({key:'step',title:'Check hiring inputs',detail:'No verified direct careers connector is linked. Using directory data if present.'})),
    (async()=>{
      let github=item.github;
      if (!signals.founded || !github) {
        await check('identity','Verify company identity',async()=>{
          const identity=await identify(item.name);
          if (!item.domain || domain(identity?.value.website)!==item.domain.replace(/^www\./,'')) return null;
          if (identity.value.founded && !signals.founded) signals.founded=signal(identity.value.founded,identity.source,'scraped','medium',identity.fetchedAt);
          github ||= identity.value.github;
          return identity;
        });
      }
      if (github) await check('github','Check public engineering activity',()=>engineering(github,3000));
    })(),
  ]);
  const result=estimate(signals);
  for (const factor of result.factors) {
    emit({key:'factor',factor,missing:missing[factor.key],asOf:result.asOf});
  }
  emit({key:'result',...result});
}
