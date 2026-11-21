import sys, os, bpy, addon_utils
ext = bpy.utils.user_resource('EXTENSIONS', path='user_default', create=True)
link = os.path.join(ext, 'mpfb')
if not os.path.exists(link): os.symlink('/home/user/makehumancommunity/mpfb2/src/mpfb', link)
bpy.ops.preferences.addon_enable(module='bl_ext.user_default.mpfb')
import importlib
def svc(mod, key): return getattr(importlib.import_module('bl_ext.user_default.mpfb.' + mod), key)
HumanService = svc('services.humanservice', 'HumanService')
TargetService = svc('services.targetservice', 'TargetService')
AssetService = svc('services.assetservice', 'AssetService')
LocationService = svc('services.locationservice', 'LocationService')
HumanObjectProperties = svc('entities.objectproperties', 'HumanObjectProperties')
