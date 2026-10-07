export type AudioCue="ui"|"move"|"impact"|"status"|"faint"|"victory"|"defeat";

interface CueShape { readonly start:number; readonly end:number; readonly type:OscillatorType; readonly volume:number; }

const SHAPES:Record<AudioCue,CueShape>={
  ui:{start:520,end:660,type:"sine",volume:.045},
  move:{start:180,end:420,type:"sawtooth",volume:.055},
  impact:{start:120,end:70,type:"square",volume:.07},
  status:{start:420,end:260,type:"triangle",volume:.045},
  faint:{start:220,end:55,type:"sine",volume:.065},
  victory:{start:392,end:784,type:"sine",volume:.055},
  defeat:{start:220,end:80,type:"sine",volume:.055},
};

export class AudioManager{
  private readonly sources=new Map<AudioCue,string>();
  private context:AudioContext|null=null;
  private disposed=false;

  public register(cue:AudioCue,url:string):void{this.sources.set(cue,url);}

  public dispose():void{
    if(this.disposed)return;
    this.disposed=true;
    this.sources.clear();
    const context=this.context;
    this.context=null;
    if(context)void context.close().catch(()=>undefined);
  }

  public play(cue:AudioCue):void{
    if(this.disposed)return;
    const url=this.sources.get(cue);
    if(url){
      try{
        const audio=new Audio(url);
        audio.volume=.7;
        void audio.play().catch(()=>undefined);
      }catch(error){void error;}
      return;
    }
    const Context=window.AudioContext ?? (window as Window & {webkitAudioContext?: typeof AudioContext}).webkitAudioContext;
    if(!Context)return;
    try{
      const context=this.context ?? (this.context=new Context());
      const shape=SHAPES[cue];
      const oscillator=context.createOscillator();
      const gain=context.createGain();
      const now=context.currentTime;
      oscillator.type=shape.type;
      oscillator.frequency.setValueAtTime(shape.start,now);
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(20,shape.end),now+.12);
      gain.gain.setValueAtTime(.0001,now);
      gain.gain.exponentialRampToValueAtTime(shape.volume,now+.012);
      gain.gain.exponentialRampToValueAtTime(.0001,now+.13);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(now);
      oscillator.stop(now+.14);
      void context.resume().catch(()=>undefined);
    }catch(error){void error;}
  }
}
