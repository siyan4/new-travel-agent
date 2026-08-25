const API_URL='https://api.deepseek.com/chat/completions';
const MODEL='deepseek-chat';
const MAX_TRIP_DAYS=30;

exports.handler=async function(event){
  if(event.httpMethod!=='POST')return json(405,{error:'Method not allowed.'});

  const apiKey=process.env.DEEPSEEK_API_KEY;
  if(!apiKey)return json(500,{error:'The route-planning service is not configured on the server.'});

  let input;
  try{input=JSON.parse(event.body||'{}')}catch{return json(400,{error:'Invalid JSON request.'})}

  const days=Number(input.days);
  if(!input.destination||!Number.isInteger(days)||days<1||days>MAX_TRIP_DAYS){
    return json(400,{error:`Choose a destination and a trip length between 1 and ${MAX_TRIP_DAYS} days.`});
  }

  const systemPrompt=`You are an expert China travel planner. Return valid JSON only, with exactly this top-level shape: {"route":{...}}. Create one complete route.

The route must contain:
- title: short English title, with a Chinese place name only when useful
- description: 1 concise paragraph explaining the route's planning logic
- daily_plan: exactly ${days} day objects
- estimated_cost: a realistic conservative range with its basis and currency
- tips: an array of no more than 4 concise strings

Each day object must contain exactly: {"day":number,"title":string,"activities":string[],"transport":string,"meals":string}. Keep activities to 3 or 4 short, practical items. Honor the user's requested daily start/end window and requested detail level. Keep every place geographically realistic for that day and include transfer buffers. Never invent exact opening hours, ticket prices, or train times; say "verify before departure" when uncertain.

The ordered planning priorities are durable account settings and must be considered first. Also respect this trip's interests, budget, transport, pace, accessibility or dietary notes, and must-do experiences. Keep the requested province/city/prefecture/county exact. Use English for all output; Chinese names may be added after key place names. Be concise.`;

  const routeStyles=[
    {name:'Personalized balance',instruction:'Balance all supplied choices, with the highest-ranked durable priority as the main tie-breaker.'},
    {name:'Local depth',instruction:'Favor deeper cultural context, distinctive local experiences and fewer rushed transfers.'},
    {name:'Easy pace',instruction:'Favor breathing room, reliable logistics, later buffers and a gentler physical pace.'}
  ];

  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),26000);
  try{
    const routes=await Promise.all(routeStyles.map(async style=>{
      const response=await fetch(API_URL,{
        method:'POST',
        headers:{'Content-Type':'application/json','Authorization':`Bearer ${apiKey}`},
        body:JSON.stringify({
          model:MODEL,
          temperature:0.5,
          max_tokens:Math.min(3200,900+days*220),
          response_format:{type:'json_object'},
          messages:[
            {role:'system',content:systemPrompt},
            {role:'user',content:JSON.stringify({routeStyle:style.name,routeStyleInstruction:style.instruction,trip:input})}
          ]
        }),
        signal:controller.signal
      });

      const upstreamText=await response.text();
      let upstream;
      try{upstream=JSON.parse(upstreamText)}catch{throw new PlannerError(502,'The planning provider returned an invalid response. Please try again.')}
      if(!response.ok)throw new PlannerError(response.status,upstream.error?.message||'The planning request was rejected. Please try again.');

      const content=upstream.choices?.[0]?.message?.content||'';
      let data;
      try{data=JSON.parse(content.replace(/^```(?:json)?\s*|\s*```$/g,''))}catch{throw new PlannerError(502,'The route planner returned data that could not be parsed. Please try again.')}
      const route=data.route||data;
      if(!Array.isArray(route.daily_plan)||route.daily_plan.length!==days)throw new PlannerError(502,'The route planner returned an incomplete daily plan. Please try again.');
      return route;
    }));
    return json(200,{routes});
  }catch(error){
    controller.abort();
    if(error.name==='AbortError')return json(504,{error:'Route planning took too long. Please try once more.'});
    if(error instanceof PlannerError)return json(error.statusCode,{error:error.message});
    console.error('Route planning function failed.',error);
    return json(502,{error:'The route-planning service could not be reached. Please try again.'});
  }finally{
    clearTimeout(timeout);
  }
};

class PlannerError extends Error{
  constructor(statusCode,message){super(message);this.statusCode=statusCode}
}

function json(statusCode,body){
  return{statusCode,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'},body:JSON.stringify(body)};
}
