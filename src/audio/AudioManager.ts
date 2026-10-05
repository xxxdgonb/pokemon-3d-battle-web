export type AudioCue="ui"|"move"|"impact"|"status"|"faint"|"victory"|"defeat";
export class AudioManager{
  private readonly sources=new Map<AudioCue,string>();
  public register(cue:AudioCue,url:string):void{this.sources.set(cue,url);}
  public play(cue:AudioCue):void{
    const url=this.sources.get(cue);
    if(!url)return;
    try{const audio=new Audio(url);audio.volume=.7;void audio.play().catch(()=>{});}catch{}
  }
}
