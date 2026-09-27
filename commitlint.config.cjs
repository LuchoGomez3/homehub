// Reglas de mensajes de commit (en ingles). La explicacion de cada una esta en CODE_GUIDE.md §2.
// Sin `extends`: las reglas estan escritas completas para que el archivo se lea solo y
// para que el CI pueda correrlo con `npx @commitlint/cli` sin instalar nada mas.
module.exports = {
  rules: {
    // tipo(ambito): asunto
    'type-enum': [
      2,
      'always',
      [
        'feat',
        'fix',
        'refactor',
        'perf',
        'test',
        'docs',
        'chore',
        'ci',
        'build',
        'style',
        'revert',
      ],
    ],
    'type-case': [2, 'always', 'lower-case'],
    'type-empty': [2, 'never'],

    // El ambito es opcional; si esta, tiene que ser uno de estos.
    'scope-enum': [
      2,
      'always',
      ['api', 'web', 'shared', 'ui', 'config', 'auth', 'db', 'deps', 'release'],
    ],
    'scope-case': [2, 'always', 'lower-case'],

    'subject-empty': [2, 'never'],
    'subject-full-stop': [2, 'never', '.'],
    'subject-case': [2, 'never', ['sentence-case', 'start-case', 'pascal-case', 'upper-case']],
    'header-max-length': [2, 'always', 72],

    'body-leading-blank': [2, 'always'],
    'body-max-line-length': [2, 'always', 100],
    'footer-leading-blank': [2, 'always'],
    'footer-max-line-length': [2, 'always', 100],
  },
};
