import os
for f in os.listdir('.'):
    if f.startswith('forestry__'):
        os.rename(f, f[10:])