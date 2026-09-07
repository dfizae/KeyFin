// Jest 전용 초기화. Reanimated 4 는 react-native-worklets 의 웹 구현으로 동작하도록
// package.json jest.resolver(react-native-worklets/jest/resolver)와 함께 쓴다.
require("react-native-reanimated").setUpTests();
