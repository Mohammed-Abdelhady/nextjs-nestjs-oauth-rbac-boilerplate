from integrate import *
C=pathlib.Path(json.loads((E/'candidate.json').read_text())['path']);env=json.loads((E/'environment.json').read_text());results=[]
for gate,args in [('test',['npm','run','test']),('build',['npm','run','build'])]:
 print('START '+gate,flush=True);started=time.time()
 with (E/(gate+'-corrected.log')).open('w') as log:r=subprocess.run(args,cwd=C,env=env,stdout=log,stderr=subprocess.STDOUT,timeout=300)
 results.append({'gate':gate,'command':args,'exit':r.returncode,'seconds':round(time.time()-started,2)});dump('corrected-gates.json',results);print(json.dumps(results[-1]),flush=True)
 if r.returncode:raise SystemExit(r.returncode)
