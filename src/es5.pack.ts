'use strict'

import * as Promise from 'bluebird'
import * as Cookies from 'cookies-js'
import * as UriTemplate from 'uri-templates'
import request from 'superagent'
import * as qs from 'querystringify'
import chch from './chinchilla'

window['Promise']     = Promise
window['Cookies']     = Cookies
window['UriTemplate'] = UriTemplate
window['request']     = request
window['qs']          = qs
window['chch']        = chch
