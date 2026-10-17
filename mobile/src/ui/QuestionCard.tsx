import { useState } from 'react';
import { TextInput, View } from 'react-native';

import { clock } from '../clock';
import { newMemory, type Question } from '../engine';
import { useStore } from '../store/AppProvider';
import { Body, Button, Card, ChipGroup, MultiChipGroup, Row, Small, TextAction } from './components';
import { space, type, useColors } from './theme';
import { TypedAnswer } from './TypedAnswer';

/** One short, skippable question. Answers become memories the user can see and edit. */
export function QuestionCard({ question }: { question: Question }) {
  const { dispatch, track } = useStore();
  const c = useColors();
  const [picked, setPicked] = useState<string[]>([]);
  const [text, setText] = useState('');

  const done = (answered: boolean) => {
    dispatch({ type: 'questionDone', id: question.id, at: clock.now().toISOString() });
    track('question_answered', { id: question.id, answered });
  };
  const save = (values: string[]) => {
    const now = clock.now();
    for (const v of values) dispatch({ type: 'remember', memory: newMemory(question.topic, v, { source: 'question', now, expiresInDays: question.expiresInDays }) });
    done(true);
  };

  return (
    <Card>
      <Row style={{ justifyContent: 'space-between' }}>
        <Small>Quick question · optional</Small>
        <TextAction label="Skip" a11yLabel="Skip this question" onPress={() => done(false)} />
      </Row>
      <Body style={{ fontWeight: '600' }}>{question.prompt}</Body>
      {question.input === 'single' ? (
        <ChipGroup options={question.options!} value={'' as string} onChange={(v) => save([v])} />
      ) : question.input === 'multi' ? (
        <>
          <MultiChipGroup options={question.options!} value={picked} onChange={setPicked} />
          <Small>Something else? Type it:</Small>
          <TypedAnswer
            start={question.topic === 'dislike_food' ? 'dislike' : question.topic === 'like_food' ? 'like' : 'neutral'}
            placeholder={question.topic === 'like_food' ? 'e.g. sushi, anything with cheese' : 'e.g. raw onion, anything too sweet'}
          />
          <Button label={picked.length ? 'Save' : 'None — that’s fine'} variant="secondary" onPress={() => (picked.length ? save(picked) : done(true))} />
        </>
      ) : (
        <View style={{ gap: space.sm }}>
          <TextInput
            value={text}
            onChangeText={(t) => setText(t.slice(0, 30))}
            maxLength={30}
            placeholder="Your name or nickname"
            placeholderTextColor={c.inkMuted}
            accessibilityLabel={question.prompt}
            style={[type.body, { color: c.ink, borderWidth: 1, borderColor: c.border, borderRadius: 12, padding: space.md }]}
          />
          <Button label="Save" variant="secondary" disabled={!text.trim()} onPress={() => save([text.trim()])} />
        </View>
      )}
    </Card>
  );
}
