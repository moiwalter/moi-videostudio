import json, subprocess, sys, torch, torchaudio
from torchaudio.pipelines import VOXPOPULI_ASR_BASE_10K_ES as B
TEXTO = open(sys.argv[3]).read().replace("\n"," ") if len(sys.argv)>3 else ("Vi por ahí que varios paquetes de Adobe ahora tienen open source Por cierto Photoshop siempre ha tenido una versión de open source "
 "Pero esa no es verdaderamente la noticia ni que vaya a ser tan fácil hacer open source La gente que creaba software libre ha tenido superpoderes el último año "
 "y están haciendo cosas increíbles Open source particularmente si te pones a examinar un poco repositorios de GitHub está creciendo como nunca "
 "Pero el cambio significativo que veo para mí es el intent al necesitar software La intención que tienen las personas cuando están buscando software "
 "Antes llegabas a Google y le decías necesito un paquete que haga tal cosa Necesito software que me haga tal cosa "
 "Hoy en cambio muchas personas simplemente llegan y así como le piden a ChatGPT a Claude y a otros que les resuelvan su vida "
 "les están pidiendo que les hagan software desde el principio Ni siquiera piensan en la intención de comprar o pagarle a alguien "
 "Es como de hoy ChatGPT la empresa necesita esta solución desarrollémosla programémosla hagamos que suceda "
 "Y ese es el verdadero cambio para muchas empresas software as a service ¿Va a desaparecer? No lo creo "
 "Las empresas grandes siempre van a tener muchas posibilidades para reinventarse y para que su producto siga funcionando "
 "Algunos simplemente van a volverse la capa especialista en una industria Pero sin embargo si alguien hoy en día viene y me dice "
 "Christian voy a hacer un software as a service para esta industria súper pequeña que siempre le hizo falta "
 "Yo creo que esas personas en esa industria están haciendo su propio software "
 "Así como hace 30 40 años las farmacias y los pequeños comercios tenían una versión hecha en Windows de su sistema para manejar el inventario la nómina y otras cosas "
 "Entonces a eso estamos cambiando porque desarrollar ese software se volvió más fácil y las personas quieren una solución bastante personalizada "
 "Y espero en los comentarios del video los que me digan que eso no escala que seguridad etcétera bla bla bla I know pero hay soluciones para eso también Bien")
PRON = {'Richie':'richi','frontier':'fronter','models':'models','legal':'ligal','advice':'advais','AI':'ei','Opus':'opus','5.5':'cinco punto cinco','Chris':'cris','Hey':'jei','gap':'gap','IA':'ia','open':'oupen','source':'sors','Photoshop':'fotoshop','GitHub':'guijab','intent':'intent','Google':'gugol','ChatGPT':'chatyipiti','Claude':'clod',
 'software':'sofwer','as':'as','a':'a','service':'servis','Christian':'cristian','30':'treinta','40':'cuarenta','Windows':'güindous','I':'ai','know':'nou','Adobe':'adobi'}
SR=16000
wav=subprocess.run(['ffmpeg','-v','error','-i',sys.argv[1],'-ac','1','-ar','16000','-f','f32le','-'],capture_output=True,check=True).stdout
audio=torch.frombuffer(bytearray(wav),dtype=torch.float32).clone()
model=B.get_model().eval(); labels=B.get_labels(); L={c:i for i,c in enumerate(labels)}
def norm(w):
    w=PRON.get(w.strip('¿?'),w).lower(); return ''.join(c for c in w if c in L) or 'a'
ems=[]
with torch.inference_mode():
    for i in range(0,audio.shape[0],30*SR):
        e,_=model(audio[None,i:i+30*SR]); ems.append(e)
em=torch.log_softmax(torch.cat(ems,1),-1); words=TEXTO.split(); toks=[]; spans=[]
for w in words:
    ws=[L[c] for c in norm(w)]; spans.append((len(toks),len(toks)+len(ws))); toks+=ws+[L['|']]
toks=toks[:-1]; spans[-1]=(spans[-1][0],len(toks))
ali,sc=torchaudio.functional.forced_align(em,torch.tensor([toks],dtype=torch.int32),blank=0)
st=torchaudio.functional.merge_tokens(ali[0],sc[0].exp()); r=audio.shape[0]/em.shape[1]/SR; out=[]
for w,(a,b) in zip(words,spans):
    c=sum(s.score*(s.end-s.start) for s in st[a:b])/max(1,sum(s.end-s.start for s in st[a:b]))
    out.append({'t':w,'s':round(st[a].start*r,2),'e':round(st[b-1].end*r,2),'tramo':1,'conf':round(float(c),2)})
json.dump(out,open(sys.argv[2],'w'),ensure_ascii=False,indent=0)
print(len(out)); print(' · '.join(f"{w['s']:.2f} {w['t']}"+('?' if w['conf']<.5 else '') for w in out))
