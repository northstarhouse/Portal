import { PDFDocument, rgb } from 'npm:pdf-lib@1.17.1';
import fontkit from 'npm:@pdf-lib/fontkit@1.1.1';
let fontPromise: Promise<ArrayBuffer> | null = null;
export async function agreementPdf(version: any) {
  if (!fontPromise) fontPromise = (async()=>{let r=await fetch('https://northstarhouse.github.io/Portal/assets/fonts/NotoSans.ttf');if(!r.ok)r=await fetch('https://raw.githubusercontent.com/notofonts/noto-fonts/c971829a87e7920f960e7277c3dafd9bedd3c601/hinted/ttf/NotoSans/NotoSans-Regular.ttf');if(!r.ok)throw new Error('PDF font unavailable. Please retry.');return r.arrayBuffer();})().catch(e=>{fontPromise=null;throw e;});
  const pdf=await PDFDocument.create();pdf.registerFontkit(fontkit);
  const font=await pdf.embedFont(await fontPromise,{subset:true});
  pdf.setTitle(version.title);pdf.setSubject('North Star House agreement version '+version.version);
  let page:any,y=0;const width=504;
  function addPage(){page=pdf.addPage([612,792]);y=738;}
  function line(value:string,size=10){if(y<60)addPage();page.drawText(value,{x:54,y,size,font,color:rgb(.16,.15,.13)});y-=size*1.6;}
  const widths=new Map<string,number>();
  function measure(value:string,size:number){const key=size+':'+value;if(!widths.has(key))widths.set(key,font.widthOfTextAtSize(value,size));return widths.get(key)!;}
  function paragraph(value:string,size=10){
    for(const raw of String(value).replace(/\r/g,'').split('\n')){
      let current='',used=0;const space=measure(' ',size);
      for(const word of raw.split(/\s+/)){
        const wordWidth=measure(word,size);
        if(current && used+space+wordWidth>width){line(current,size);current='';used=0;}
        if(wordWidth<=width){current+=(current?' ':'')+word;used+=(used?space:0)+wordWidth;}
        else for(const char of word){const charWidth=measure(char,size);if(used+charWidth>width){line(current,size);current='';used=0;}current+=char;used+=charWidth;}
      }
      line(current,size);
    }
  }
  addPage();paragraph(version.title,16);paragraph('Version '+version.version+' · '+version.status,10);line('');if(version.change_summary){paragraph('Changes in this version',12);paragraph(version.change_summary);line('');}paragraph(version.body);
  addPage();paragraph('Electronic signature record',16);paragraph('Agreement version: '+version.version+' | Document ID: '+version.id);paragraph('Document SHA-256: '+(version.document_hash || 'DRAFT — not issued'));
  for(const signer of version.recipients || []){line('');paragraph(signer.name+' ('+signer.role+')');paragraph(signer.email);paragraph(signer.status==='signed'?'Signed as '+signer.signed_name+' at '+signer.signed_at:'Status: '+signer.status);if(signer.consent)paragraph(signer.consent,9);if(signer.evidence)paragraph('Verification evidence: '+JSON.stringify(signer.evidence),8);}
  line('');paragraph('Audit history',13);for(const event of version.events || [])paragraph(event.created_at+' | '+event.action+' | '+event.actor+(Object.keys(event.detail||{}).length?' | '+JSON.stringify(event.detail):''),8);
  const pages=pdf.getPages();for(let i=0;i<pages.length;i++)pages[i].drawText('North Star House · Version '+version.version+' · '+(i+1)+' / '+pages.length,{x:54,y:30,size:8,font,color:rgb(.45,.42,.36)});
  return await pdf.save();
}
