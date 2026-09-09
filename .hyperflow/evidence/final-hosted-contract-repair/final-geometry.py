import subprocess,json,pathlib,time
P=pathlib.Path(__file__).resolve().parent
C=pathlib.Path('/var/folders/d1/tk4y3j012j57stv_sy0qpglr0000gn/T/production-hardening-integration-4lfc21qz')
env=json.loads(pathlib.Path('/Users/mohammedabdelhady/Documents/ref/nextjs-nestjs-oauth-rbac-boilerplate/.hyperflow/evidence/t30-release-native/environment.json').read_text())
with (P/'final-geometry.log').open('w') as log:r=subprocess.run([str(C/'node_modules/.bin/playwright'),'test','--config',str(P/'final-geometry.config.mjs')],cwd=C/'frontend',env=env,stdout=log,stderr=subprocess.STDOUT,timeout=200)
print('final geometry exit',r.returncode)
