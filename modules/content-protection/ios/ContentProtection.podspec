Pod::Spec.new do |s|
  s.name           = 'ContentProtection'
  s.version        = '1.0.0'
  s.summary        = 'Screenshot / screen-recording protection and secure rendering surfaces.'
  s.description    = 'Native iOS content protection for protected educational video and documents.'
  s.author         = 'EduPlatform'
  s.homepage       = 'https://example.com'
  s.platforms      = { :ios => '15.1' }
  s.source         = { :git => '' }
  s.static_framework = true
  s.license        = { :type => 'Proprietary' }

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
