#!/usr/bin/env python3
"""Build and run local logic/package checks; does not claim browser testing."""
from pathlib import Path
import re
import shutil
import subprocess
import sys

ROOT=Path(__file__).resolve().parents[1]


def main():
    if not shutil.which('node'):
        raise SystemExit('Node.js is required for the JavaScript tests.')
    output=ROOT/'checks'
    output.mkdir(exist_ok=True)
    tests=[p.relative_to(ROOT).as_posix() for p in sorted((ROOT/'tests').glob('*.test.*'))]
    commands=[[sys.executable,'build.py'],['node','--test',*tests],
              [sys.executable,'tests/package-check.py'],[sys.executable,'tests/test_publish.py']]
    if (ROOT/'scene').is_dir():
        commands.append([sys.executable,'tests/integration-package-check.py'])
    transcript=[]
    for command in commands:
        print('$ '+' '.join(command),flush=True)
        result=subprocess.run(command,cwd=ROOT,text=True,capture_output=True)
        print(result.stdout,end='')
        print(result.stderr,end='',file=sys.stderr)
        transcript.extend(['$ '+' '.join(command)+'\n',result.stdout,result.stderr])
        if result.returncode:
            (output/'latest-checks.txt').write_text(''.join(transcript))
            raise SystemExit(result.returncode)
    summary='Local logic, naming, asset integrity and packaging checks passed. No browser rendering or live GitHub publication was performed.\n'
    transcript.append(summary)
    (output/'latest-checks.txt').write_text(''.join(transcript),encoding='utf-8')
    print(summary,end='')


if __name__=='__main__':
    main()
