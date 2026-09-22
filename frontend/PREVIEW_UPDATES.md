# Preview APK와 EAS Update

팀 내부 Android 테스트는 `preview` 채널과 EAS `preview` 환경을 사용한다.
아래 명령은 `frontend` 디렉터리에서 실행한다. EAS CLI 23.2.0 이상과 Expo 로그인이 필요하다.

로컬과 EAS 빌드 모두 `pnpm@12.4.2`를 사용한다. `pnpm-workspace.yaml`의
`virtualStoreDirMaxLength: 60`은 Windows와 Linux의 설치 경로 차이로 fingerprint가
달라지는 것을 방지하므로 유지한다. 배포 전 `pnpm install --frozen-lockfile`로 설치 상태를 맞춘다.

## 환경변수

APK 빌드의 `environment: "preview"`와 업데이트 명령의 `--environment preview`가
동일한 EAS 서버 환경변수를 읽는다. 로컬 `.env`의 값이나 `eas.json`의 빌드 전용
`env`를 API 설정의 공통 원천으로 사용하지 않는다.

| 변수 | 값의 의미 |
| --- | --- |
| `EXPO_PUBLIC_API_URL` | 실제 API 서버의 HTTPS 호스트. `/api/v1`은 앱이 붙이므로 호스트만 설정한다. |
| `EXPO_PUBLIC_LIVE_DOMAINS` | `all`이면 모든 도메인을 실서버로 연결한다. 일부만 연동할 때는 도메인을 쉼표로 구분한다. |

API 주소가 없으면 앱은 샘플 데이터를 사용한다. 배포 전에 `eas env:list --environment preview`로
두 값을 확인한다. `EXPO_PUBLIC_*`는 앱 번들에 포함되는 공개 값이므로 인증 토큰을 넣지 않는다.
EAS Update에서도 읽을 수 있도록 visibility는 `plaintext` 또는 `sensitive`를 사용한다.

## 최초 설치 또는 네이티브 변경 후

```sh
pnpm install --frozen-lockfile
eas build --platform android --profile preview
```

완료된 빌드 페이지의 Install 링크에서 APK를 휴대폰에 설치한다.
이 설정 이전에 만든 APK에는 EAS Update를 보낼 수 없으므로 최초 한 번은 새 APK가 필요하다.
preview APK는 ARM64 Android 휴대폰용 release 빌드이며, PC의 Metro 개발 서버 없이 실행된다.

## 화면·로직·이미지 업데이트 배포

```sh
eas update --platform android --channel preview --environment preview --message "로그인 화면 및 API 연동 수정"
```

`--channel preview`와 `--environment preview`를 항상 함께 지정한다.
배포 결과의 runtime version이 설치한 preview 빌드의 runtime version과 일치하는지 확인한다.
다르면 새 APK가 필요하며, 기존 APK에 전달하려고 runtime version을 강제로 맞추지 않는다.

## 휴대폰에서 확인

1. 최초 APK를 설치하고 로그인·조회 등을 실행해 실제 백엔드와 통신하는지 확인한다.
2. 화면의 문구처럼 확인하기 쉬운 내용을 변경해 위 명령으로 업데이트를 배포한다.
3. 인터넷이 연결된 상태에서 앱을 완전히 종료한 후 다시 연다. 앱 시작 시 업데이트를 백그라운드에서 다운로드한다.
4. 다운로드할 시간을 준 뒤 앱을 완전히 종료하고 다시 연다. 새 문구가 보이는지 확인한다.
5. PC의 개발 서버를 종료한 상태에서도 앱 실행과 API 연결이 되는지 확인한다.

앱을 홈 화면으로 내리는 것만으로는 재시작이 되지 않을 수 있다. Android 최근 앱 목록에서
앱을 닫은 후 다시 실행한다. 이미지가 많거나 연결이 느리면 다운로드에 더 오래 걸릴 수 있다.
설정은 `checkAutomatically: "ON_LOAD"`, `fallbackToCacheTimeout: 0`이므로 시작 화면을
다운로드 때문에 기다리게 하지 않고, 다운로드가 끝난 업데이트를 다음 시작에 적용한다.
이미 다운로드된 앱은 PC 없이 실행되지만, 업데이트 다운로드와 실제 API 호출에는 네트워크가 필요하다.

## APK를 다시 빌드하는 기준

`runtimeVersion`은 `fingerprint` 정책이다. Expo가 네이티브 의존성과 앱 설정 등을 바탕으로
호환성 해시를 계산하고, 같은 런타임인 APK에만 업데이트를 전달한다.

| 변경 | 처리 |
| --- | --- |
| 화면 배치·문구·일반 버튼 동작·API 호출 로직 | 기존 네이티브 API와 호환되면 EAS Update |
| JS에서 사용하는 화면 이미지 | EAS Update |
| 네이티브 라이브러리 추가·삭제·업데이트, Expo SDK·React Native 변경 | APK 재빌드·재설치 |
| Android 권한, 앱 아이콘, 패키지명, 네이티브 폰트·config plugin 설정 변경 | APK 재빌드·재설치 |
| 업데이트 URL·채널 등 APK에 포함되는 업데이트 설정 변경 | APK 재빌드·재설치 |
| 그 밖에 fingerprint가 달라진 변경 | 새 APK 생성 후 해당 런타임으로 업데이트 |

fingerprint는 보수적으로 호환성을 판단하므로 의존성·설정 변경에 따라 예상보다 자주
새 APK가 필요할 수 있다. 단순 JS 변경만 배포할 때는 의존성이나 네이티브 설정을 함께 바꾸지 않는다.
EAS Update는 Gradle 컴파일을 가속하는 기능이 아니라 호환되는 변경에서 APK 빌드를 생략하는 기능이다.

## 참고

- [EAS Update 설정과 배포](https://docs.expo.dev/eas-update/getting-started/)
- [런타임 호환성](https://docs.expo.dev/eas-update/runtime-versions/)
- [EAS 환경변수](https://docs.expo.dev/eas/environment-variables/)
