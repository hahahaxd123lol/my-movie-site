
(() => {
  'use strict';

  const EXACT_BLOCKS=[
    '103',
    'caversham road',
    '103 caversham road',
    'b440tx',
    'road'
  ];

  // English profanity + racist/hate slur patterns. The worker uses the same
  // normalization and remains the authoritative enforcement point.
  const BLOCKED_WORDS=[
    'fuck','fucking','fucked','fucker','motherfucker',
    'shit','shitty','bullshit',
    'bitch','bastard','cunt','dick','prick','wanker','twat',
    'slut','whore','piss','pissed','asshole','damn','hell','bloody','crap','arse','bollocks','bugger','cock','pussy','sod','shag',
    'nigger','nigga','chink','gook','spic','kike','paki',
    'coon','wetback','raghead','sandnigger','faggot','fag'
  ];

  const LEET={
    '0':'o','1':'i','2':'z','3':'e','4':'a','5':'s',
    '6':'g','7':'t','8':'b','9':'g','@':'a','$':'s','!':'i'
  };

  function normalize(value=''){
    return String(value)
      .normalize('NFKC')
      .toLowerCase()
      .split('')
      .map(ch=>LEET[ch]||ch)
      .join('');
  }

  function escapeRegex(value=''){
    return String(value).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  }

  function obscuredWordPattern(word){
    return new RegExp(
      `(?:^|[^a-z0-9])${word.split('').map(escapeRegex).join('[^a-z0-9]*')}(?:$|[^a-z0-9])`,
      'i'
    );
  }

  function looksLikeAddress(text=''){
    const n=normalize(text);

    // UK-style postcode, including no-space forms such as B44 0TX / B440TX.
    if(/\b[a-z]{1,2}\d[a-z\d]?\s*\d[a-z]{2}\b/i.test(n))return true;

    // House/building number followed by a street-style suffix.
    if(
      /\b\d{1,5}\s+[a-z0-9][a-z0-9 .,'-]{0,45}\s(?:road|rd|street|st|avenue|ave|lane|ln|drive|dr|close|cl|court|ct|way|place|pl|terrace|crescent|cres|boulevard|blvd|highway|hwy)\b/i.test(n)
    )return true;

    // Flat/unit + number patterns followed by normal address-like wording.
    if(
      /\b(?:flat|apartment|apt|unit|house|room)\s*\d+[a-z]?(?:\s|,)+[a-z0-9]/i.test(n)
    )return true;

    return false;
  }

  window.f2wCheckPublicChatText=function(message=''){
    const raw=String(message||'')
      .replace(/\[\[image:https:\/\/[^\]\s]+\]\]/gi,' ')
      .trim();

    if(!raw)return {ok:true};

    const n=normalize(raw);
    const spaced=n.replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();
    const compact=n.replace(/[^a-z0-9]+/g,'');

    if(
      compact.includes('103cavershamroad')
      ||compact.includes('cavershamroad')
      ||compact.includes('b440tx')
    ){
      return {ok:false,reason:'That message contains blocked personal/address information.'};
    }

    for(const phrase of EXACT_BLOCKS){
      if(phrase==='103'){
        if(/\b103\b/.test(spaced)){
          return {ok:false,reason:'That message contains blocked personal/address information.'};
        }
        continue;
      }

      if(phrase==='road'){
        if(/\broad\b/.test(spaced)){
          return {ok:false,reason:'That message contains blocked personal/address information.'};
        }
        continue;
      }

      const normalizedPhrase=normalize(phrase).replace(/[^a-z0-9]+/g,' ').trim();
      if(spaced.includes(normalizedPhrase)){
        return {ok:false,reason:'That message contains blocked personal/address information.'};
      }
    }

    if(looksLikeAddress(raw)){
      return {ok:false,reason:'Physical addresses and address-like information are not allowed in public chat.'};
    }

    for(const word of BLOCKED_WORDS){
      if(obscuredWordPattern(word).test(n)){
        return {ok:false,reason:'Swearing, racist language and abusive slurs are not allowed in public chat.'};
      }
    }

    return {ok:true};
  };

  function appendPlain(host,text){
    if(text)host.appendChild(document.createTextNode(text));
  }

  window.f2wAppendChatLinkedText=function(host,text=''){
    const raw=String(text||'');
    const urlRe=/https?:\/\/[^\s<>"']+/gi;
    let last=0;
    let match;

    while((match=urlRe.exec(raw))){
      appendPlain(host,raw.slice(last,match.index));

      let url=match[0];
      let trailing='';

      // Keep sentence punctuation outside the link.
      while(/[),.!?;:]$/.test(url)){
        trailing=url.slice(-1)+trailing;
        url=url.slice(0,-1);
      }

      try{
        const parsed=new URL(url);
        if(parsed.protocol==='http:'||parsed.protocol==='https:'){
          const a=document.createElement('a');
          a.href=parsed.href;
          a.target='_blank';
          a.rel='noopener noreferrer';
          a.referrerPolicy='no-referrer';
          a.dataset.f2wAllowPopup='true';
          a.className='chat-link';
          a.textContent=url;
          host.appendChild(a);
        }else{
          appendPlain(host,url);
        }
      }catch{
        appendPlain(host,url);
      }

      appendPlain(host,trailing);
      last=match.index+match[0].length;
    }

    appendPlain(host,raw.slice(last));
  };
})();
