// Normalize one post at a time. Never traverse comments, related posts, user or channel totals.
import {count,FIELDS} from '../../../compound/impact/metrics.js';
const paths={
 tt:{views:['view_count','play_count','playCount','viewCount'],likes:['like_count','digg_count','diggCount'],comments:['comment_count','commentCount'],shares:['share_count','shareCount'],saves:['collect_count','collectCount','favorites_count']},
 ig:{views:['views','play_count','video_play_count','ig_play_count','video_view_count','playCount','view_count','plays'],likes:['like_count','edge_media_preview_like.count','edge_liked_by.count'],comments:['comment_count','comments_count','edge_media_to_parent_comment.count','edge_media_to_comment.count'],shares:['share_count','reshare_count','shares_count'],saves:['save_count','saved_count','saved']},
 x:{views:['impression_count'],likes:['like_count','favorite_count'],comments:['reply_count','conversation_count'],saves:['bookmark_count']},
 li:{views:['impressions','video_views','views','IMPRESSION'],likes:['reactions','REACTION'],comments:['comments','COMMENT'],shares:['reposts','RESHARE'],saves:['saves','POST_SAVE']},
 yt:{views:['viewCount'],likes:['likeCount'],comments:['commentCount']},tw:{views:['view_count','viewCount']}
};
const providerFields={views:['viewsCount','viewCount'],likes:['likesCount','likeCount'],comments:['commentsCount','commentCount'],shares:['sharesCount','shareCount'],saves:['savesCount','saveCount']};
export function normalize(platform,item,{oriane=false}={}){
 const out={},roots=[item,item?.statistics,item?.stats,item?.statsV2,item?.metrics,item?.public_metrics].filter(Boolean);
 for(const k of FIELDS){const names=[...(oriane?[k,...providerFields[k]]:[]),...(paths[platform]?.[k]||[])];outer:for(const root of roots)for(const field of names){const value=count(field.split('.').reduce((v,n)=>v?.[n],root));if(value!==null){out[k]=value;break outer;}}}
 if(platform==='ig'){const ins=item?.insights?.data||item?.insights;if(Array.isArray(ins))for(const [ours,names]of Object.entries({views:['views','plays'],shares:['shares'],saves:['saved'],likes:['likes'],comments:['comments']})){
 for(const name of names){const entry=ins.find(v=>v.name===name);const v=count(entry?.total_value?.value??entry?.values?.at(-1)?.value);if(v!==null){out[ours]=v;break;}}}}
 if(platform==='x'){const pub=item.public_metrics||item;const rt=count(pub.retweet_count),qt=count(pub.quote_count);if(rt!==null&&qt!==null)out.shares=rt+qt;if(out.views!=null)out.view_metric='impressions';}
 if(platform==='li'&&out.views!=null)out.view_metric=(item.impressions!=null||item.IMPRESSION!=null)?'impressions':'views';
 return out;
}
